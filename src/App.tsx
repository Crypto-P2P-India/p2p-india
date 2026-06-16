import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WalletProvider from "@/components/WalletProvider";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import MyOrders from "./pages/MyOrders";
import MyAds from "./pages/MyAds";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Guide from "./pages/Guide";
import Profile from "./pages/Profile";
import Transparency from "./pages/Transparency";

import NotFound from "./pages/NotFound";
import DealNotificationsHost from "@/components/DealNotificationsHost";

import DisclaimerModal from "@/components/DisclaimerModal";
import BottomNav from "@/components/BottomNav";
import NotificationPermission from "@/components/NotificationPermission";
import UpdateBanner from "@/components/UpdateBanner";
import SplashScreen from "@/components/SplashScreen";

const App = () => (
  <WalletProvider>
    <TooltipProvider>
      <SplashScreen />
      <UpdateBanner />
      <DisclaimerModal />

      <NotificationPermission />
      <DealNotificationsHost />
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <div className="pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/my-ads" element={<MyAds />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/transparency" element={<Transparency />} />
            <Route path="/how-it-works" element={<Transparency />} />
            <Route path="/fees" element={<Transparency />} />

            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </WalletProvider>
);

export default App;
