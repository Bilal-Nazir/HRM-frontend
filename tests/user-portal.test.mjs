import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let currentUser;
const Link = ({ children, ...props }) => React.createElement('a', props, children);
function load(file, mocks = {}) {
  const scope = { exports: {}, URL, URLSearchParams, window: {}, require(name) {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.css')) return {};
    if (name === '@/lib/auth') return { getSession: () => currentUser };
    if (name === '@/lib/access') return load('lib/access.ts');
    if (name === '@/lib/taskLinks') return load('lib/taskLinks.ts');
    if (name === '@/lib/workspace') return { canManageContent: (user) => !!user?.permissions.some((permission) => ['*', 'organization.update'].includes(permission)) };
    return require(name);
  } };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, scope);
  return scope.exports;
}
const owner = { userId: 'owner', loginId: 'owner@example.com', organizationId: 'company', accountType: 'employee', isPlatformAdmin: false, isCompanyOwner: true, permissions: ['organization.update', 'employee.read.all', 'attendance.read.team', 'leave.manage', 'project.manage'] };
const employee = { ...owner, userId: 'employee', isCompanyOwner: false, permissions: ['project.read', 'project.task'] };
const platform = { ...owner, userId: 'platform', accountType: 'admin', isPlatformAdmin: true, permissions: ['*'] };
test('company authority grants management controls without granting Super Admin routes', () => {
  const access = load('lib/access.ts'), routes = load('lib/authRoutes.ts');
  assert.equal(access.canManageProjects(owner), true); assert.equal(access.isCompanyAdministrator(owner), true);
  assert.equal(access.portalPrefix(owner), ''); assert.equal(routes.sessionHome(owner), '/dashboard');
  assert.equal(access.canManageProjects(employee), false); assert.equal(access.portalPrefix(employee), '');
  assert.equal(routes.sessionHome(platform), '/admin/dashboard'); assert.equal(access.portalPrefix(platform), '/admin');
  const staleOwner = { ...owner, accountType: 'admin', permissions: ['*'] };
  assert.equal(routes.portalForUser(staleOwner), 'employee'); assert.equal(routes.sessionHome(staleOwner), '/dashboard');
  assert.equal(routes.authenticatedRedirect('/admin/settings/company', '', 'employee'), '/settings/company');
  assert.equal(routes.authenticatedRedirect('/admin/employees/person', '?tab=tasks', 'employee'), '/employees/person?tab=tasks');
});
test('the shared user dashboard, attendance, requests and announcements retain company admin features', () => {
  const pages = [
    ['app/dashboard/page.tsx', '@/components/AdminHome', '@/components/EmployeeDashboard'],
    ['app/attendance/page.tsx', '@/components/CompanyAttendancePage', '@/components/PersonalAttendancePage'],
    ['app/leave/page.tsx', '@/components/CompanyRequestsPage', '@/components/PersonalRequestsPage'],
    ['app/announcements/page.tsx', '@/components/ManageAnnouncementsPage', '@/components/CompanyAnnouncementsPage'],
  ];
  for (const [file, management, personal] of pages) {
    const mocks = { [management]: { __esModule: true, default: () => React.createElement('p', {}, 'Company management') }, [personal]: { __esModule: true, default: () => React.createElement('p', {}, 'Personal workspace') } };
    // CSS imports do not affect component choice.
    mocks['@/app/employee-theme.css'] = {}; mocks['@/app/admin-home.css'] = {}; mocks['@/app/dashboard-engagement.css'] = {};
    const Page = load(file, mocks).default;
    currentUser = owner; assert.match(renderToStaticMarkup(React.createElement(Page)), /Company management/, file);
    currentUser = employee; assert.match(renderToStaticMarkup(React.createElement(Page)), /Personal workspace/, file);
  }
});
test('workspace navigation and settings expose the correct links for each portal', () => {
  for (const user of [owner, platform, employee]) {
    for (const open of [false, true]) {
      currentUser = user; let index = 0;
      const prefix = user.isPlatformAdmin ? '/admin' : '';
      const hooks = { ...React, useState: (value) => [index++ === 0 ? user : typeof value === 'function' ? value() : value, () => {}], useEffect() {} };
      const Shell = load('components/AppShell.tsx', {
        react: hooks, 'next/link': { __esModule: true, default: Link },
        'next/navigation': { usePathname: () => `${prefix}/${open ? 'settings/profile' : 'dashboard'}`, useRouter: () => ({}) },
        '@/lib/api': {}, '@/lib/useClientClock': { useClientClock: () => null },
        '@/components/ChatProvider': { __esModule: true, default: ({ children }) => React.createElement(React.Fragment, null, children) },
        '@/components/ChatLauncher': { __esModule: true, default: () => null },
        '@/components/Avatar': { __esModule: true, default: ({ name }) => React.createElement('span', {}, name) },
        '@/components/CompanySwitcher': { __esModule: true, default: () => null }, '@/components/NotificationCenter': { __esModule: true, default: () => null },
      }).default;
      const html = renderToStaticMarkup(React.createElement(Shell, null, 'Content'));
      assert.match(html, /aria-controls="sidebar-settings-options"/);
      assert.equal((html.match(/aria-label="Add shortcut [123]"/g) || []).length, 3);
      assert.doesNotMatch(html, /Choose up to 3 quick links|class="sidebar-shortcuts"/);
      const navigation = html.slice(html.indexOf('<nav class="nav-list">'), html.indexOf('</nav>'));
      const canManageCompany = user.isCompanyOwner || user.isPlatformAdmin;
      assert.ok(navigation.includes(`href="${prefix}/terms"`));
      assert.equal(navigation.includes(`href="${prefix}/hiring"`), canManageCompany);
      assert.equal(navigation.includes(`href="${prefix}/attendance/standup"`), canManageCompany);
      assert.doesNotMatch(html, /href="[^"]*\/settings\/hiring"/);
      if (open) {
        for (const path of ['/settings/profile', '/settings/password', '/settings/theme']) assert.ok(html.includes(`href="${prefix}${path}"`), path);
        assert.equal(html.includes(`href="${prefix}/settings/company"`), canManageCompany);
      } else {
        assert.doesNotMatch(html, /href="[^"]*\/settings\//);
      }
      if (!user.isPlatformAdmin) assert.doesNotMatch(html, /href="\/admin\//);
      else assert.match(html, /Super Admin workspace/);
      assert.equal(html.includes(`href="${prefix}/employees"`), user !== employee);
    }
  }
});
test('project creation remains available to company admins on the user side', () => {
  for (const user of [owner, employee]) {
    currentUser = user;
    const hooks = { ...React, useState: (value) => [value, () => {}], useEffect() {}, useCallback: (fn) => fn };
    const Page = load('components/ProjectsPage.tsx', {
      react: hooks, 'next/link': { __esModule: true, default: Link }, '@/lib/api': {},
      '@/components/AppShell': { __esModule: true, default: ({ children }) => React.createElement('main', {}, children) },
      '@/components/ui': { PageHeader: ({ action }) => React.createElement('header', {}, action) },
    }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    if (user.isCompanyOwner) assert.match(html, /Create project/); else assert.doesNotMatch(html, /Create project/);
    assert.doesNotMatch(html, /href="\/admin\//);
  }
});
