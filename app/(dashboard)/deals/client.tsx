"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Plus,
  IndianRupee,
  Calendar,
  Building2,
  Search,
  Upload,
  RefreshCw,
  X,
  Target,
  Users,
  CheckCircle2,
} from "lucide-react";
import { createDeal, updateDealStage, syncFromHubSpot, updateDeal, deleteDeal } from "@/app/actions";
import { CrmStageTracker } from "@/components/hubspot/crm/CrmStageTracker";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
import Papa from "papaparse";

const STAGES = [
  "Appointment Scheduled",
  "Qualified to Buy",
  "Presentation Scheduled",
  "Decision Maker Bought-In",
  "Contract Sent",
  "Closed Won",
  "Closed Lost",
];

function DraggableDealCard({
  deal,
  onClick,
}: {
  deal: any;
  onClick: () => void;
}) {
  console.log("AI SCORE:", deal.ai_score);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: deal.id.toString(),
      data: { deal },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-background border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group relative ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="font-medium text-sm mb-1">{deal.name}</div>
      {/* 
      {deal.ai_score !== null && deal.ai_score !== undefined && (
        <div className="text-xs text-green-500 font-medium">
          AI Score: {Number(deal.ai_score).toFixed(1)}%
        </div>
      )} */}

      {deal.ai_score !== null &&
        deal.ai_score !== undefined &&
        (() => {
          const score = Number(deal.ai_score);
          const rounded = Math.round(score);

          const getColor = () => {
            if (score >= 80) return "bg-green-500";
            if (score >= 50) return "bg-yellow-500";
            return "bg-red-500";
          };

          const getTextColor = () => {
            if (score >= 80) return "text-green-600";
            if (score >= 50) return "text-yellow-600";
            return "text-red-500";
          };

          const getLabel = () => {
            if (score >= 80) return "High";
            if (score >= 50) return "Moderate";
            return "Low";
          };

          return (
            <div className="mt-1 space-y-1">
              {/* top row */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Success Probability
                </span>
                <span className={`text-[11px] font-semibold ${getTextColor()}`}>
                  {rounded}%
                </span>
              </div>

              {/* progress bar */}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getColor()} rounded-full transition-all`}
                  style={{ width: `${rounded}%` }}
                />
              </div>

              {/* label */}
              <div className={`text-[10px] font-medium ${getTextColor()}`}>
                {getLabel()} probability
              </div>
            </div>
          );
        })()}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3" />
          {Number(deal.amount).toLocaleString("en-IN")}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary hover:bg-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          Manage
        </Button>
      </div>
      {deal.close_date && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Calendar className="h-3 w-3" />
          {new Date(deal.close_date).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function DroppableColumn({
  stage,
  deals,
  totalAmount,
  onDealClick,
}: {
  stage: string;
  deals: any[];
  totalAmount: number;
  onDealClick: (deal: any) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: stage,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-[280px] flex flex-col gap-3 bg-surface/30 rounded-xl p-3 border border-border/50 h-full"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <h3 className="font-semibold text-sm truncate" title={stage}>
          {stage}
        </h3>
        <span className="text-xs text-muted-foreground">{deals.length}</span>
      </div>
      <div className="text-xs font-medium text-muted-foreground mb-2">
        ₹{totalAmount.toLocaleString("en-IN")}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px]">
        {deals.map((deal) => (
          <DraggableDealCard
            key={deal.id}
            deal={deal}
            onClick={() => onDealClick(deal)}
          />
        ))}
      </div>
    </div>
  );
}



export default function DealsClient({
  initialDeals,
  companies,
}: {
  initialDeals: any[];
  companies: any[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDragDeal, setActiveDragDeal] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedStage, setSelectedStage] = useState(STAGES[0]);
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [championIdentified, setChampionIdentified] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useMemo(() => {
    setMounted(true);
  }, []);

  // Sync state with props when data is refreshed or search results change
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  // Filter deals based on search
  const filteredDeals = useMemo(() => {
    return deals.filter(
      (deal) =>
        deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.company_name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [deals, searchQuery]);

  async function handleSubmit(formData: FormData) {
    console.log("Creating deal...");
    await createDeal(formData);
    setIsLoading(false);
    setIsModalOpen(false);
    window.location.reload();
  }

  useEffect(() => {
    if (isSidebarOpen) {
      console.log("SIDEBAR OPENED for deal:", selectedDeal?.id);
    }
  }, [isSidebarOpen, selectedDeal]);

  async function handleSyncHubSpot() {
    setIsLoading(true);
    try {
      const res = await syncFromHubSpot();
      console.log("Sync response:", res);
      window.location.reload();
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  }

  async function handleUpdateDeal(formData: FormData) {
    if (!selectedDeal) return;
    setIsLoading(true);
    await updateDeal(selectedDeal.id, formData);
    setIsLoading(false);
    setIsSidebarOpen(false);
    window.location.reload();
  }

  async function handleDeleteDeal(id: number) {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    setIsLoading(true);
    await deleteDeal(id);
    setIsLoading(false);
    setIsSidebarOpen(false);
    window.location.reload();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragDeal(null);

    if (!over) return;

    const dealId = parseInt(active.id as string);
    const newStage = over.id as string;
    const deal = deals.find((d) => d.id === dealId);

    if (deal && deal.stage !== newStage) {
      setDeals(
        deals.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)),
      );
      await updateDealStage(dealId, newStage);

      // Trigger: If moved to Presentation Scheduled, open sidebar as a prompt
      if (newStage === "Presentation Scheduled") {
        setSelectedDeal({ ...deal, stage: newStage });
        setIsSidebarOpen(true);
      }
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const deal = event.active.data.current?.deal;
    setActiveDragDeal(deal);
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setIsLoading(true);
        for (const row of results.data as any[]) {
          if (row.name && row.stage) {
            const formData = new FormData();
            formData.append("name", row.name);
            formData.append("amount", row.amount || "0");
            formData.append("stage", row.stage);
            formData.append("close_date", row.close_date || "");
            await createDeal(formData);
          }
        }
        setIsLoading(false);
        setIsImportModalOpen(false);
        window.location.reload();
      },
    });
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Deals Pipeline</h2>
          <p className="text-muted-foreground">
            Manage your sales pipeline and track revenue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          {/* <Button onClick={handleSyncHubSpot} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Syncing...' : 'Sync HubSpot'}
          </Button> */}
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full min-w-[1200px]">
            {STAGES.map((stage) => {
              const stageDeals = filteredDeals.filter((d) => d.stage === stage);
              const totalAmount = stageDeals.reduce(
                (sum, deal) => sum + Number(deal.amount),
                0,
              );

              return (
                <DroppableColumn
                  key={stage}
                  stage={stage}
                  deals={stageDeals}
                  totalAmount={totalAmount}
                  onDealClick={(deal) => {
                    setSelectedDeal(deal);
                    setIsSidebarOpen(true);
                  }}
                />
              );
            })}
          </div>
        </div>
        {mounted &&
          typeof window !== "undefined" &&
          createPortal(
            <DragOverlay>
              {activeDragDeal ? (
                <div className="bg-background border border-border rounded-lg p-3 shadow-xl w-[280px] rotate-3 cursor-grabbing">
                  <div className="font-medium text-sm mb-1">
                    {activeDragDeal.name}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      {Number(activeDragDeal.amount).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Deal"
      >
        <form action={handleSubmit} className="space-y-6">
          {/* Header context */}
          <div className="pb-2 border-b border-border/50">
            <h2 className="text-xl font-semibold">Create Deal</h2>
            <p className="text-sm text-muted-foreground">
              Add a new deal to your pipeline
            </p>
          </div>

          <div className="space-y-4">
            {/* Deal Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Deal Name *
              </Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Enterprise License - TechCorp"
                className="focus-visible:ring-2 focus-visible:ring-primary h-11"
              />
            </div>

            {/* Amount + Date */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold">
                  Amount (₹)
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₹
                  </div>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    placeholder="50,000"
                    className="pl-7 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="close_date" className="text-sm font-semibold">
                  Close Date
                </Label>
                <Input
                  id="close_date"
                  name="close_date"
                  type="date"
                  className="h-11"
                />
              </div>
            </div>

            {/* Stage Section */}
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-base font-semibold">Deal Stage</Label>
                <p className="text-xs text-muted-foreground">
                  Move the deal through your pipeline
                </p>
              </div>

              <input type="hidden" name="stage" value={selectedStage} />

              <div className="w-full bg-muted/30 border border-border/50 rounded-xl p-6">
                <CrmStageTracker
                  stages={STAGES.slice(0, 5)} // Only show open stages for tracker
                  currentStage={selectedStage}
                  onStageClick={setSelectedStage}
                />
              </div>
            </div>

            {/* Company Selection */}
            <div className="space-y-2">
              <Label htmlFor="company_id" className="text-sm font-semibold">
                Company
              </Label>
              <select
                id="company_id"
                name="company_id"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Select a company...</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Signal Toggles */}
            <div className="pt-2">
              <Label className="text-sm font-semibold">AI Validation Signals</Label>
              <p className="text-[10px] text-muted-foreground mb-3">
                Toggle these to improve AI win-probability accuracy.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 border border-border/50 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={demoCompleted} 
                    onChange={(e) => setDemoCompleted(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <input type="hidden" name="demo_completed" value={demoCompleted ? "true" : "false"} />
                  <span className="text-sm font-medium">Product Demo</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-border/50 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={championIdentified} 
                    onChange={(e) => setChampionIdentified(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <input type="hidden" name="champion_identified" value={championIdentified ? "true" : "false"} />
                  <span className="text-sm font-medium">Champion Identified</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[140px] h-11"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating...
                </span>
              ) : (
                "Create Deal"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Deals"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with columns:{" "}
            <code>name, amount, stage, close_date</code>
          </p>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv">CSV File</Label>
            <Input id="csv" type="file" accept=".csv" onChange={handleImport} />
          </div>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Importing...</p>
          )}
        </div>
      </Modal>

      {/* Deal Detail Sidebar - Portaled for best reliability */}
      {mounted && typeof window !== "undefined" && isSidebarOpen && selectedDeal && createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-background shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/60">
              <div>
                <h3 className="text-xl font-bold font-heading">{selectedDeal.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {selectedDeal.company_name || 'Individual Deal'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* AI Score Widget */}
              {selectedDeal.ai_score !== undefined && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                         <Target className="h-4 w-4 text-primary" />
                         Success Probability
                       </span>
                       <span className="text-2xl font-black text-primary">
                         {Math.round(selectedDeal.ai_score)}%
                       </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-700"
                        style={{ width: `${selectedDeal.ai_score}%` }}
                      />
                    </div>
                    <p className="mt-4 text-[11px] text-muted-foreground italic leading-relaxed">
                      "According to our ML model, this deal is {Math.round(selectedDeal.ai_score) > 50 ? 'trending towards a close' : 'at risk and needs more activity'}."
                    </p>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  // Ensure checkboxes send false if unchecked
                  if (!fd.has("demo_completed")) fd.append("demo_completed", "false");
                  if (!fd.has("champion_identified")) fd.append("champion_identified", "false");
                  await handleUpdateDeal(fd);
                }} 
                className="space-y-6"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
                    <Input name="name" defaultValue={selectedDeal.name} className="hidden" />
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</div>
                      <Input name="amount" type="number" defaultValue={selectedDeal.amount} className="pl-7 h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Close Date</Label>
                    <Input name="close_date" type="date" defaultValue={selectedDeal.close_date ? new Date(selectedDeal.close_date).toISOString().split('T')[0] : ''} className="h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Stage</Label>
                   <select 
                    name="stage" 
                    defaultValue={selectedDeal.stage}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                   >
                     {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>

                {/* Milestone Toggles */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                   <h4 className="text-sm font-bold flex items-center gap-2">
                     <CheckCircle2 className="h-4 w-4 text-primary" />
                     Execution Milestones
                   </h4>
                   <div className="grid grid-cols-1 gap-2">
                     <label className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">Product Demo</span>
                          <span className="text-[10px] text-muted-foreground">Validation of solution value</span>
                        </div>
                        <input 
                          name="demo_completed"
                          type="checkbox" 
                          defaultChecked={selectedDeal.demo_completed}
                          className="h-5 w-5 accent-primary cursor-pointer"
                          value="true"
                        />
                     </label>

                     <label className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">Champion Identified</span>
                          <span className="text-[10px] text-muted-foreground">Stakeholder buy-in secured</span>
                        </div>
                        <input 
                          name="champion_identified"
                          type="checkbox" 
                          defaultChecked={selectedDeal.champion_identified}
                          className="h-5 w-5 accent-primary cursor-pointer"
                          value="true"
                        />
                     </label>
                   </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <Button type="submit" className="flex-1 h-12 text-sm font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Update Deal & AI Score"}
                  </Button>
                  <Button type="button" variant="destructive" size="icon" className="h-12 w-12 shrink-0 border border-red-200" onClick={() => handleDeleteDeal(selectedDeal.id)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
