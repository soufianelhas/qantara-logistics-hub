import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LandedCostEngine from "./pages/LandedCostEngine";
import HSNeuralNavigator from "./pages/HSNeuralNavigator";
import AuthenticityStudio from "./pages/AuthenticityStudio";
import DocumentationWorkshop from "./pages/DocumentationWorkshop";
import ShipmentDetails from "./pages/ShipmentDetails";
import AllShipments from "./pages/AllShipments";
import Clients from "./pages/Clients";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AuthGuard } from "./components/AuthGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/landed-cost" element={<AuthGuard><LandedCostEngine /></AuthGuard>} />
          <Route path="/hs-navigator" element={<AuthGuard><HSNeuralNavigator /></AuthGuard>} />
          <Route path="/authenticity-studio" element={<AuthGuard><AuthenticityStudio /></AuthGuard>} />
          <Route path="/documentation-workshop" element={<AuthGuard><DocumentationWorkshop /></AuthGuard>} />
          <Route path="/shipments" element={<AuthGuard><AllShipments /></AuthGuard>} />
          <Route path="/shipments/:id" element={<AuthGuard><ShipmentDetails /></AuthGuard>} />
          <Route path="/clients" element={<AuthGuard><Clients /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
