import { Button } from "@/components/ui/button";
import { ArrowRight, Luggage } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-20 md:py-28 bg-card">
      <div className="container mx-auto px-4">
        <div className="relative bg-gradient-primary rounded-3xl p-8 md:p-16 overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-3xl" />
          
          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left Content */}
            <div className="text-center lg:text-left max-w-xl">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                  <Luggage className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-primary-foreground/80 font-medium">
                  Ready to travel light?
                </span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Start Storing Your Luggage Today
              </h2>
              <p className="text-lg text-primary-foreground/80">
                Join thousands of happy travelers. First-time users get 20% off their first booking!
              </p>
            </div>

            {/* Right CTA */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" className="bg-accent hover:bg-accent/90">
                Book Now
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="hero-outline" size="xl">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
