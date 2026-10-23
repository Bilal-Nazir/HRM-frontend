"use client";
import { Calendar, CheckSquare2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { ProjectTask } from "@/types";
export default function MyTasks(){const[tasks,setTasks]=useState<ProjectTask[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);useEffect(()=>{api.get<{tasks:ProjectTask[]}>("/projects/my-tasks").then(d=>setTasks(d.tasks||[])).catch(e=>setError(e instanceof ApiError?e.message:"Could not load assigned work")).finally(()=>setLoading(false))},[]);return <AppShell><PageHeader eyebrow="My work" title="Assigned tasks" description="Shared project work currently assigned to you."/>{error&&<ErrorBanner message={error}/>}<section className="card">{loading?<div className="loading-line"/>:!tasks.length?<EmptyState title="Nothing assigned" description="Tasks assigned to you will appear here."/>:<div className="my-task-list">{tasks.map(task=><Link key={task.id} href={`/projects/${task.projectId}/board`}><span className={`issue-type type-${task.type}`}>{task.type}</span><div><strong>{task.title}</strong><small>{task.project?.name} · {task.key}</small></div><span className={`priority priority-${task.priority}`}>{task.priority}</span><time><Calendar size={13}/>{task.dueDate?new Date(task.dueDate).toLocaleDateString():"No due date"}</time><CheckSquare2 size={17}/></Link>)}</div>}</section></AppShell>}
