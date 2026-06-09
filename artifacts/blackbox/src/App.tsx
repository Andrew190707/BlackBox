import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WSProvider } from "@/hooks/use-blackbox-ws";
import { Dashboard } from "@/components/Dashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WSProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="*" component={() => <div className="p-8 text-center text-red-500">404 NOT FOUND</div>} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </WSProvider>
    </QueryClientProvider>
  );
}

export default App;
