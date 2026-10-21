"use client";

import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, PageHeader, StatusPill } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { Employee } from "@/types";
import { Plus, Search, UserPlus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

const emptyForm = { firstName:"", lastName:"", workEmail:"", password:"", jobTitle:"", employmentType:"full-time", phone:"", personalEmail:"", timezone:"", employmentStatus:"active" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { setSearch(new URLSearchParams(window.location.search).get("search") || ""); }, []);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api.get<{ employees: Employee[] }>(`/employee/view?size=100${search?`&search=${encodeURIComponent(search)}`:""}`); setEmployees(result.employees || []); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load employees"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const timer=setTimeout(load,250); return()=>clearTimeout(timer); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try { if (editing) await api.patch(`/employee/${editing.id}`, { firstName: form.firstName, lastName: form.lastName, workEmail: form.workEmail, jobTitle: form.jobTitle, employmentType: form.employmentType, phone: form.phone, personalEmail: form.personalEmail, timezone: form.timezone, employmentStatus: form.employmentStatus }); else await api.post("/employee/create", { firstName: form.firstName, lastName: form.lastName, workEmail: form.workEmail, password: form.password, jobTitle: form.jobTitle, employmentType: form.employmentType, phone: form.phone }); setModal(false); setEditing(null); setForm(emptyForm); await load(); setSuccess(editing ? "Employee profile updated." : "Employee created with an automatically generated ID."); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save employee"); }
    finally { setSaving(false); }
  };

  const startEdit = async (employee: Employee) => { setSaving(true); setError(""); setSuccess(""); try { const result = await api.get<{ employee: Employee }>(`/employee/${employee.id}`); const detail = result.employee; setEditing(detail); setForm({ ...emptyForm, firstName: detail.firstName, lastName: detail.lastName, workEmail: detail.workEmail, jobTitle: detail.jobTitle || "", employmentType: detail.employmentType || "full-time", phone: detail.phone || "", personalEmail: detail.personalEmail || "", timezone: detail.timezone || "", employmentStatus: detail.employmentStatus || "active" }); setModal(true); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not load employee profile"); } finally { setSaving(false); } };
  const archive = async (employee: Employee) => { if (!window.confirm(`Remove ${employee.firstName} ${employee.lastName}? Their login will be disabled and they will leave the directory, but attendance and request history will remain.`)) return; setSaving(true); setError(""); try { await api.delete(`/employee/${employee.id}`); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not remove employee"); } finally { setSaving(false); } };

  return <AppShell>
    <PageHeader eyebrow="People directory" title="Employees" description="Manage employee records, access, and employment status in one place." action={<button className="button button-primary" onClick={()=>{setEditing(null);setForm(emptyForm);setModal(true);}}><Plus size={17}/>Add employee</button>} />
    {error && !modal && <ErrorBanner message={error}/>} {success && <div className="success-banner" role="status">{success}</div>}
    <div className="toolbar"><div className="field" style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:13,color:"#819088"}}/><input style={{paddingLeft:38}} placeholder="Search name, email or employee code" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <section className="card">
      {loading && <div className="loading-line"/>}
      {!loading && employees.length===0 ? <EmptyState title="No employees found" description="Add your first employee or adjust the current search."/> : <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Employee ID</th><th>Role / title</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.id}><td><div className="person-cell"><div className="avatar">{employee.firstName[0]}{employee.lastName[0]}</div><div><strong>{employee.firstName} {employee.lastName}</strong><span>{employee.workEmail}</span></div></div></td><td>{employee.employeeCode}</td><td>{employee.jobTitle || "—"}</td><td style={{textTransform:"capitalize"}}>{employee.employmentType || "—"}</td><td><StatusPill value={employee.employmentStatus}/></td><td><div className="admin-table-actions"><button className="button button-secondary" disabled={saving} onClick={()=>startEdit(employee)}>Edit</button><button className="button button-secondary" disabled={saving} onClick={()=>void archive(employee)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    </section>

    {modal && <div className="modal-backdrop"><form className="modal" onSubmit={create}><div className="modal-header"><div><h2>{editing ? "Edit employee" : "Add employee"}</h2><p>{editing ? "Update their profile details." : "Create their profile and initial login account."}</p></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={18}/></button></div><div className="modal-body">{error&&<ErrorBanner message={error}/>}<div className="form-grid">
      <div className="field"><label>First name</label><input required value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></div>
      <div className="field"><label>Last name</label><input required value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></div>
      <div className="field"><label>Employment type</label><select value={form.employmentType} onChange={e=>setForm({...form,employmentType:e.target.value})}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></div>
      <div className="field full"><label>Work email</label><input type="email" required value={form.workEmail} onChange={e=>setForm({...form,workEmail:e.target.value})}/></div>
      <div className="field"><label>Job title</label><input value={form.jobTitle} onChange={e=>setForm({...form,jobTitle:e.target.value})}/></div>
      <div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
      {editing && <><div className="field"><label>Personal email</label><input type="email" value={form.personalEmail} onChange={e=>setForm({...form,personalEmail:e.target.value})}/></div><div className="field"><label>Time zone</label><input placeholder="Asia/Karachi" value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></div><div className="field"><label>Employment status</label><select value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option></select></div></>}
      {!editing && <div className="field"><label>Temporary password</label><input type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>}
    </div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={()=>setModal(false)}>Cancel</button><button className="button button-primary" disabled={saving}><UserPlus size={17}/>{saving?"Saving...":editing?"Save changes":"Create employee"}</button></div></form></div>}
  </AppShell>;
}
