"use client";
import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { CompanySession, applyCompanySession } from "@/lib/companies";
import { ErrorBanner, PageHeader } from "@/components/ui";
type Member = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  employeeCode: string;
};
type Role = {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole?: boolean;
};
const permissionLabels: Record<string, string> = {
  "organization.read": "View company settings",
  "organization.update": "Edit company settings",
  "office.read": "View offices",
  "office.manage": "Manage offices",
  "department.read": "View departments and teams",
  "department.manage": "Manage departments and teams",
  "employee.read.self": "View own employee profile",
  "employee.read.team": "View team profiles",
  "employee.read.all": "View employee directory",
  "employee.create": "Add employees",
  "employee.update.self": "Edit own contact details",
  "employee.update.employment": "Edit employee records",
  "employee.archive": "Archive employees",
  "role.read": "View roles",
  "role.manage": "Manage roles (admin only)",
  "role.assign": "Assign roles (admin only)",
  "audit.read": "View company audit history",
  "attendance.checkin": "Check in and check out",
  "attendance.read.self": "View own attendance",
  "attendance.read.team": "View team attendance",
  "leave.read.self": "View own requests",
  "leave.request": "Submit leave requests",
  "leave.manage": "Manage leave and requests",
  "leave.approve": "Review requests",
  "project.read": "View assigned projects",
  "project.task": "Work on project tasks",
  "project.manage": "Manage projects",
};
export default function CompanySettings() {
  const user = getSession();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<Member[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [permissions, setPermissions] = useState<string[]>([]);
  const [company, setCompany] = useState({
    name: "",
    timezone: "UTC",
    slug: "",
    ownerUserId: "",
  });
  const [role, setRole] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });
  const [assignment, setAssignment] = useState({ employeeId: "", roleId: "" });
  const [invited, setInvited] = useState(""),
    [invitation, setInvitation] = useState(""),
    [target, setTarget] = useState(""),
    [confirmation, setConfirmation] = useState("");
  async function load() {
    try {
      const [organization, people, access, catalogue] = await Promise.all([
        api.get<{ organization: typeof company }>("/organization"),
        api.get<{ members: Member[] }>("/companies/members"),
        api.get<{ roles: Role[] }>("/access/roles"),
        api.get<{ permissions: string[] }>("/access/permissions"),
      ]);
      setCompany(organization.organization);
      setMembers(people.members);
      setRoles(
        access.roles.filter((item) => item.name !== "Organization Admin"),
      );
      setPermissions(catalogue.permissions);
      setLoaded(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load company settings",
      );
    }
  }
  useEffect(() => {
    if (user?.isCompanyOwner || user?.isPlatformAdmin) void load();
  }, []);
  async function action(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save changes",
      );
    } finally {
      setBusy(false);
    }
  }
  function saveCompany(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      await api.patch("/organization", {
        name: company.name,
        timezone: company.timezone,
      });
      setMessage("Company details saved.");
    });
  }
  function createRole(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      await api.post("/access/roles", role);
      setRole({ name: "", description: "", permissions: [] });
      await load();
      setMessage("Role created. Assign it to an employee below.");
    });
  }
  function assignRole(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      await api.post("/access/assignments", {
        ...assignment,
        scopeType: "organization",
      });
      setMessage("Role assigned. Permissions take effect immediately.");
    });
  }
  function invite(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const result = await api.post<{ token: string; email: string }>(
        "/companies/invitations",
        { employeeId: invited },
      );
      setInvitation(`${window.location.origin}/join?token=${result.token}`);
      setMessage(
        `Invitation created for ${result.email}. Share the link with that person. It expires in 7 days.`,
      );
    });
  }
  function transfer(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      applyCompanySession(
        await api.post<CompanySession>("/companies/transfer-ownership", {
          userId: target,
          confirmation,
        }),
      );
    });
  }
  if (!user?.isCompanyOwner && !user?.isPlatformAdmin)
    return (
      <AppShell>
        <ErrorBanner message="Only the company admin or Super Admin can manage these settings." />
      </AppShell>
    );
  return (
    <AppShell>
      <PageHeader
        eyebrow="Company administration"
        title="Company settings"
        description="Manage your company, custom roles, invitations and ownership."
        action={
          <Link className="button button-secondary" href="/companies">
            Switch company
          </Link>
        }
      />
      {error && <ErrorBanner message={error} />}{" "}
      {message && (
        <div className="success-banner" role="status">
          {message}
        </div>
      )}
      {!loaded && !error && <p role="status">Loading company settings…</p>}
      {loaded && (
        <div className="company-settings">
          <form className="company-panel" onSubmit={saveCompany}>
            <h2>{company.name}</h2>
            <p className="muted">
              Company ID: {company.slug}. Each company has one admin, determined
              by ownership.
            </p>
            <div className="company-form-grid">
              <label>
                Company name
                <input
                  required
                  value={company.name}
                  onChange={(event) =>
                    setCompany({ ...company, name: event.target.value })
                  }
                />
              </label>
              <label>
                Time zone
                <input
                  required
                  value={company.timezone}
                  onChange={(event) =>
                    setCompany({ ...company, timezone: event.target.value })
                  }
                />
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              Save company
            </button>
          </form>
          <section className="company-panel">
            <h2>Roles and permissions</h2>
            <p className="muted">
              Delegate specific work through roles. Roles do not create
              additional company admins.
            </p>
            {roles.map((item) => (
              <div className="company-role-row" key={item.id}>
                <strong>{item.name}</strong>
                <small>
                  {item.permissions.length} permissions
                  {item.isSystemRole ? " · Default role" : ""}
                </small>
              </div>
            ))}
            <form onSubmit={createRole}>
              <div className="company-form-grid">
                <label>
                  Role name
                  <input
                    required
                    maxLength={64}
                    value={role.name}
                    onChange={(event) =>
                      setRole({ ...role, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Description
                  <input
                    value={role.description}
                    onChange={(event) =>
                      setRole({ ...role, description: event.target.value })
                    }
                  />
                </label>
              </div>
              <p>Choose permissions</p>
              <div className="company-permissions">
                {permissions.map((permission) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={role.permissions.includes(permission)}
                      onChange={(event) =>
                        setRole({
                          ...role,
                          permissions: event.target.checked
                            ? [...role.permissions, permission]
                            : role.permissions.filter(
                                (item) => item !== permission,
                              ),
                        })
                      }
                    />
                    {permissionLabels[permission] || permission}
                  </label>
                ))}
              </div>
              <button
                className="button button-primary"
                disabled={busy || !role.permissions.length}
              >
                Create role
              </button>
            </form>
            <form className="company-form-grid" onSubmit={assignRole}>
              <label>
                Employee
                <select
                  required
                  value={assignment.employeeId}
                  onChange={(event) =>
                    setAssignment({
                      ...assignment,
                      employeeId: event.target.value,
                    })
                  }
                >
                  <option value="">Choose employee</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select
                  required
                  value={assignment.roleId}
                  onChange={(event) =>
                    setAssignment({ ...assignment, roleId: event.target.value })
                  }
                >
                  <option value="">Choose role</option>
                  {roles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-secondary" disabled={busy}>
                Assign role
              </button>
            </form>
          </section>
          <form className="company-panel" onSubmit={invite}>
            <h2>Invite an employee</h2>
            <p className="muted">
              Add the employee under Employees first. The invitation is tied to
              their work email.
            </p>
            <label>
              Employee
              <select
                required
                value={invited}
                onChange={(event) => setInvited(event.target.value)}
              >
                <option value="">Choose employee</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.email}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" disabled={busy}>
              Create invitation link
            </button>
            {invitation && (
              <div className="company-invitation">
                <label>
                  Share this invitation
                  <input
                    readOnly
                    value={invitation}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(invitation)
                      .then(() => setMessage("Invitation link copied."))
                      .catch(() =>
                        setMessage(
                          "Select the invitation link above to copy it.",
                        ),
                      )
                  }
                >
                  Copy link
                </button>
              </div>
            )}
          </form>
          <form className="company-panel" onSubmit={transfer}>
            <h2>Transfer ownership</h2>
            <p>
              This replaces the current company admin. Your access afterward
              will depend on your employee roles.
            </p>
            <label>
              New company admin
              <select
                required
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">Choose an active member</option>
                {members
                  .filter(
                    (member) =>
                      member.userId && member.userId !== company.ownerUserId,
                  )
                  .map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.name} · {member.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Type {company.slug} to confirm
              <input
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              className="button button-secondary"
              disabled={busy || confirmation !== company.slug}
            >
              Transfer company ownership
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}
