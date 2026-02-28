import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CompassContent } from "./CompassContent";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompassSheetProps {
    children?: React.ReactNode;
    triggerClassName?: string;
    onClose?: () => void;
}

export function CompassSheet({ children, triggerClassName, onClose }: CompassSheetProps) {
    const [open, setOpen] = useState(false);

    const handlePushToCalculator = () => {
        setOpen(false);
        if (onClose) {
            onClose();
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children || (
                    <Button variant="outline" size="sm" className={triggerClassName}>
                        <Compass className="w-4 h-4 mr-2 text-primary" />
                        <span className="font-medium text-primary">Get Market Intelligence</span>
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[95vw] sm:max-w-2xl overflow-y-auto pt-6 border-l border-border bg-background shadow-2xl">
                <SheetHeader className="mb-6 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Compass className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <SheetTitle className="text-lg font-bold">The Compass</SheetTitle>
                            <SheetDescription className="text-xs">
                                Identify prime target markets and perform reverse-financial constraints.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="pb-8">
                    <CompassContent isOverlay={true} onPushToCalculator={handlePushToCalculator} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
