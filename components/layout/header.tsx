import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
    return (
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/50 bg-surface/50 px-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 flex-1">
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error ring-2 ring-surface" />
                </Button>
            </div>
        </header>
    );
}
