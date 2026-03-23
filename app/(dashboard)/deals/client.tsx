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
} from "lucide-react";
import { createDeal, updateDealStage, syncFromHubSpot } from "@/app/actions";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
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
        {deal.company_name && (
          <div className="flex items-center gap-1" title={deal.company_name}>
            <Building2 className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{deal.company_name}</span>
          </div>
        )}
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

import { CrmStageTracker } from "@/components/hubspot/crm/CrmStageTracker";

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
    setIsLoading(true);
    await createDeal(formData);
    setIsLoading(false);
    setIsModalOpen(false);
    window.location.reload();
  }

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

      <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
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
                    // Handle edit if needed
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
    </div>
  );
}
