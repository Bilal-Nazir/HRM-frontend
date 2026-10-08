"use client";

import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, PageHeader, StatusPill } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { Employee } from "@/types";
import { Plus, Search, UserPlus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

const emptyForm = { employeeCode:"", firstName:"", lastName:"", workEmail:"", password:"", jobTitle:"", employmentType:"full-time" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api.get<{ employees: Employee[] }>(`/employee/view?size=100${search?`&search=${encodeURIComponent(search)}`:""}`); setEmployees(result.employees || []); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load employees"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const timer=setTimeout(load,250); return()=>clearTimeout(timer); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await api.post("/employee/create", form); setModal(false); setForm(emptyForm); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not create employee"); }
    finally { setSaving(false); }
  };

  return <AppShell>
    <PageHeader eyebrow="People directory" title="Employees" description="Manage employee records, access, and employment status in one place." action={<button className="button button-primary" onClick={()=>setModal(true)}><Plus size={17}/>Add employee</button>} />
    {error && !modal && <ErrorBanner message={error}/>} 
    <div className="toolbar"><div className="field" style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:13,color:"#819088"}}/><input style={{paddingLeft:38}} placeholder="Search name, email or employee code" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <section className="card">
      {loading && <div className="loading-line"/>}
      {!loading && employees.length===0 ? <EmptyState title="No employees found" description="Add your first employee or adjust the current search."/> : <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Employee ID</th><th>Role / title</th><th>Type</th><th>Status</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.id}><td><div className="person-cell"><div className="avatar">{employee.firstName[0]}{employee.lastName[0]}</div><div><strong>{employee.firstName} {employee.lastName}</strong><span>{employee.workEmail}</span></div></div></td><td>{employee.employeeCode}</td><td>{employee.jobTitle || "—"}</td><td style={{textTransform:"capitalize"}}>{(employee as Employee & {employmentType?:string}).employmentType || "—"}</td><td><StatusPill value={employee.employmentStatus}/></td></tr>)}</tbody></table></div>}
    </section>

    {modal && <div className="modal-backdrop"><form className="modal" onSubmit={create}><div className="modal-header"><div><h2>Add employee</h2><p>Create their profile and initial login account.</p></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={18}/></button></div><div className="modal-body">{error&&<ErrorBanner message={error}/>}<div className="form-grid">
      <div className="field"><label>First name</label><input required value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></div>
      <div className="field"><label>Last name</label><input required value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></div>
      <div className="field"><label>Employee ID</label><input required placeholder="EMP-002" value={form.employeeCode} onChange={e=>setForm({...form,employeeCode:e.target.value})}/></div>
      <div className="field"><label>Employment type</label><select value={form.employmentType} onChange={e=>setForm({...form,employmentType:e.target.value})}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></div>
      <div className="field full"><label>Work email</label><input type="email" required value={form.workEmail} onChange={e=>setForm({...form,workEmail:e.target.value})}/></div>
      <div className="field"><label>Job title</label><input value={form.jobTitle} onChange={e=>setForm({...form,jobTitle:e.target.value})}/></div>
      <div className="field"><label>Temporary password</label><input type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
    </div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={()=>setModal(false)}>Cancel</button><button className="button button-primary" disabled={saving}><UserPlus size={17}/>{saving?"Creating...":"Create employee"}</button></div></form></div>}
  </AppShell>;
}
