import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserProvider } from "./contexts/UserContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import SignUp from "@/pages/SignUp";
import SignIn from "@/pages/SignIn";
import OTPVerify from "@/pages/OTPVerify";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import UserDashboard from "@/pages/UserDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminAnalytics from "@/pages/AdminAnalytics";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import SalesAdminDashboard from "@/pages/SalesAdminDashboard";
import AdminVerifications from "@/pages/AdminVerifications";
import PartnerDashboard from "@/pages/PartnerDashboard";
import CustomerDashboard from "@/pages/CustomerDashboard";
import InvestorDashboard from "@/pages/InvestorDashboard";
import VendorDashboard from "@/pages/VendorDashboard";
import BrokerDashboard from "@/pages/BrokerDashboard";
import TradePage from "@/pages/TradePage";
import MeetingsPage from "@/pages/MeetingsPage";
import Payment from "@/pages/Payment";
import MapViewPage from "@/pages/MapViewPage";
import AreaAnalyticsPage from "@/pages/AreaAnalyticsPage";
import GoogleOAuthComplete from "@/pages/GoogleOAuthComplete";
import NewsPage from "@/pages/NewsPage";
import AIChatPage from "@/pages/AIChatPage";
import RegisteredProfessionals from "@/pages/RegisteredProfessionals";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/signup" component={SignUp} />
      <Route path="/signin" component={SignIn} />
      <Route path="/google-oauth-complete" component={GoogleOAuthComplete} />
      <Route path="/verify-otp" component={OTPVerify} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={UserDashboard} />
      <Route path="/dashboard/customer" component={CustomerDashboard} />
      <Route path="/dashboard/investor" component={InvestorDashboard} />
      <Route path="/dashboard/vendor" component={VendorDashboard} />
      <Route path="/dashboard/vendor/trade" component={TradePage} />
      <Route path="/dashboard/broker" component={BrokerDashboard} />
      <Route path="/dashboard/broker/meetings" component={MeetingsPage} />
      <Route path="/dashboard/broker/area-analytics" component={AreaAnalyticsPage} />
      <Route path="/dashboard/broker/map" component={MapViewPage} />
      <Route path="/dashboard/investor/map" component={MapViewPage} />
      <Route path="/dashboard/vendor/map" component={MapViewPage} />
      <Route path="/dashboard/customer/map" component={MapViewPage} />
      <Route path="/dashboard/investor/area-analytics" component={AreaAnalyticsPage} />
      <Route path="/dashboard/vendor/area-analytics" component={AreaAnalyticsPage} />
      <Route path="/dashboard/customer/area-analytics" component={AreaAnalyticsPage} />
      <Route path="/dashboard/news" component={NewsPage} />
      <Route path="/dashboard/broker/news" component={NewsPage} />
      <Route path="/dashboard/investor/news" component={NewsPage} />
      <Route path="/dashboard/vendor/news" component={NewsPage} />
      <Route path="/dashboard/customer/news" component={NewsPage} />
      <Route path="/dashboard/ai-chat" component={AIChatPage} />
      <Route path="/dashboard/broker/ai-chat" component={AIChatPage} />
      <Route path="/dashboard/investor/ai-chat" component={AIChatPage} />
      <Route path="/dashboard/vendor/ai-chat" component={AIChatPage} />
      <Route path="/dashboard/customer/ai-chat" component={AIChatPage} />
      <Route path="/superadmin/dashboard" component={SuperAdminDashboard} />
      <Route path="/superadmin/projects" component={SalesAdminDashboard} />
      <Route path="/superadmin/professionals" component={RegisteredProfessionals} />
      <Route path="/superadmin/ai-chat" component={AIChatPage} />
      <Route path="/superadmin/news" component={NewsPage} />
      <Route path="/dashboard/superadmin/map" component={MapViewPage} />
      <Route path="/salesadmin/dashboard" component={SalesAdminDashboard} />
      <Route path="/salesadmin/projects" component={SalesAdminDashboard} />
      <Route path="/salesadmin/ai-chat" component={AIChatPage} />
      <Route path="/salesadmin/news" component={NewsPage} />
      <Route path="/dashboard/salesadmin/map" component={MapViewPage} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/verifications" component={AdminVerifications} />
      <Route path="/admin/ai-chat" component={AIChatPage} />
      <Route path="/admin/news" component={NewsPage} />
      <Route path="/partner/dashboard" component={PartnerDashboard} />
      <Route path="/partner/ai-chat" component={AIChatPage} />
      <Route path="/partner/news" component={NewsPage} />
      <Route path="/payment" component={Payment} />
      <Route path="/map" component={MapViewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
