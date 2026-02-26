import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Brain, Calculator, FileCheck } from "lucide-react";

export type WorkflowStep = 1 | 2 | 3;

interface StepDef {
  number: WorkflowStep;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const STEPS: StepDef[] = [
  { number: 1, label: "Classify", sublabel: "HS Code",        icon: Brain },
  { number: 2, label: "Calculate", sublabel: "Landed Cost",   icon: Calculator },
  { number: 3, label: "Finalize",  sublabel: "Save & File",   icon: FileCheck },
];

interface WorkflowStepperProps {
  currentStep: WorkflowStep;
}

export function WorkflowStepper({ currentStep }: WorkflowStepperProps) {
  return (
    <div className="mb-6">
      <div className="bg-card border border-border rounded-xl px-6 py-4 shadow-card">
        <div className="flex items-center justify-between relative">
          {/* Connector lines */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex px-[10%]">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-px transition-colors duration-500",
                  currentStep > i + 1
                    ? "bg-primary"
                    : currentStep === i + 1
                    ? "bg-gradient-to-r from-primary to-border"
                    : "bg-border"
                )}
              />
            ))}
          </div>

          {STEPS.map((step) => {
            const isCompleted = currentStep > step.number;
            const isActive = currentStep === step.number;
            const isPending = currentStep < step.number;
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="relative flex flex-col items-center gap-2 z-10"
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-12 h-12 aspect-square rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : isActive
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 leading-none" />
                  ) : (
                    <Icon className="w-5 h-5 leading-none" />
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-tight",
                      isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] leading-tight mt-0.5",
                      isActive
                        ? "text-primary"
                        : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {step.sublabel}
                  </p>
                </div>

                {/* Active highlight oval */}
                {isActive && (
                  <div className="absolute -inset-x-4 -inset-y-2 rounded-2xl border-2 border-primary/25 bg-card animate-pulse pointer-events-none -z-10" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
