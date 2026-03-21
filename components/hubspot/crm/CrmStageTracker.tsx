import React from 'react';
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CrmStageTrackerProps {
    stages: string[];
    currentStage: string;
    onStageClick?: (stage: string) => void;
    className?: string;
}

export function CrmStageTracker({ stages, currentStage, onStageClick, className }: CrmStageTrackerProps) {
    const currentIndex = stages.indexOf(currentStage);

    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-center justify-between w-full pr-4">
                {stages.map((stage, index) => {
                    const isActive = currentStage === stage;
                    const isCompleted = stages.indexOf(currentStage) > index;
                    const isLast = index === stages.length - 1;

                    return (
                        <div
                            key={stage}
                            className={cn(
                                "flex items-center",
                                !isLast && "flex-1"
                            )}
                            onClick={() => onStageClick?.(stage)}
                        >
                            <div className="flex flex-col items-center gap-2 relative group cursor-pointer">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-200 z-10",
                                    isCompleted && "bg-primary border-primary text-white",
                                    isActive && "border-primary text-primary bg-white shadow-sm ring-2 ring-primary/20",
                                    !isCompleted && !isActive && "border-gray-300 text-gray-500 bg-white"
                                )}>
                                    {isCompleted ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>

                                {/* Tooltip label */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {stage}
                                </div>
                            </div>

                            {!isLast && (
                                <div className={cn(
                                    "flex-1 h-[2px] mx-2 transition-all duration-300",
                                    isCompleted ? "bg-primary" : "bg-gray-300"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
