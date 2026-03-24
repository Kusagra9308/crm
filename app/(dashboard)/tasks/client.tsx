'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Plus, Calendar, CheckCircle2, Circle, User, Building2, DollarSign } from "lucide-react";
import { createTask, updateTaskStatus } from '@/app/actions';
import { cn } from "@/lib/utils";

export default function TasksClient({ initialTasks, contacts, companies, deals }: { initialTasks: any[], contacts: any[], companies: any[], deals: any[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        await createTask(formData);
        setIsLoading(false);
        setIsModalOpen(false);
        setSelectedCompanyId("");
    }

    async function toggleStatus(task: any) {
        const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
        await updateTaskStatus(task.id, newStatus);
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
                    <p className="text-muted-foreground">
                        Manage your to-dos and follow-ups.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Task
                </Button>
            </div>

            <div className="grid gap-4">
                {initialTasks.map((task) => (
                    <Card key={task.id} className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow group">
                        <button
                            onClick={() => toggleStatus(task)}
                            className={cn(
                                "shrink-0 transition-colors",
                                task.status === 'Completed' ? "text-success" : "text-muted-foreground hover:text-primary"
                            )}
                        >
                            {task.status === 'Completed' ? (
                                <CheckCircle2 className="h-6 w-6" />
                            ) : (
                                <Circle className="h-6 w-6" />
                            )}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className={cn(
                                "font-medium truncate",
                                task.status === 'Completed' && "line-through text-muted-foreground"
                            )}>
                                {task.title}
                            </div>
                            {task.description && (
                                <div className="text-sm text-muted-foreground truncate">
                                    {task.description}
                                </div>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {task.due_date && (
                                    <div className={cn(
                                        "flex items-center gap-1",
                                        new Date(task.due_date) < new Date() && task.status !== 'Completed' && "text-error font-medium"
                                    )}>
                                        <Calendar className="h-3 w-3" />
                                        {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                )}
                                {task.contact_first_name && (
                                    <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {task.contact_first_name} {task.contact_last_name}
                                    </div>
                                )}
                                {task.company_name && (
                                    <div className="flex items-center gap-1">
                                        <Building2 className="h-3 w-3" />
                                        {task.company_name}
                                    </div>
                                )}
                                {task.deal_name && (
                                    <div className="flex items-center gap-1 text-primary font-medium shrink-0">
                                        <DollarSign className="h-3 w-3" />
                                        <span className="truncate max-w-[120px]">{task.deal_name}</span>
                                    </div>
                                )}
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                    task.priority === 'High' ? "bg-error/10 text-error border-error/20" :
                                        task.priority === 'Medium' ? "bg-warning/10 text-warning border-warning/20" :
                                            "bg-secondary text-muted-foreground border-border"
                                )}>
                                    {task.priority}
                                </span>
                            </div>
                        </div>
                    </Card>
                ))}
                {initialTasks.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                        No tasks found. Create one to get started.
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedCompanyId(""); }}
                title="Add New Task"
            >
                <form action={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Task Title *</Label>
                        <Input id="title" name="title" required placeholder="Follow up with client" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" name="description" placeholder="Details about the task..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="due_date">Due Date</Label>
                            <Input id="due_date" name="due_date" type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <select
                                id="priority"
                                name="priority"
                                defaultValue="Medium"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contact_id">Related Contact</Label>
                             <select
                                id="contact_id"
                                name="contact_id"
                                onChange={(e) => {
                                    const contactId = e.target.value;
                                    const contact = contacts.find(c => c.id.toString() === contactId);
                                    if (contact?.company_id) {
                                        setSelectedCompanyId(contact.company_id.toString());
                                    }
                                }}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="">Select a contact...</option>
                                {contacts.map((contact) => (
                                    <option key={contact.id} value={contact.id}>
                                        {contact.first_name} {contact.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company_id">Related Company</Label>
                            <select
                                id="company_id"
                                name="company_id"
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="">Select a company...</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                        {company.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>


                    <div className="space-y-2">
                        <Label htmlFor="deal_id">Related Deal</Label>
                        <select
                            id="deal_id"
                            name="deal_id"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="">Select a deal...</option>
                            {deals
                                .filter(deal => !selectedCompanyId || deal.company_id === parseInt(selectedCompanyId))
                                .map((deal) => (
                                    <option key={deal.id} value={deal.id}>
                                        {deal.name} {deal.company_name ? `(${deal.company_name})` : ''} - ${deal.amount}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); setSelectedCompanyId(""); }}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Task'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
