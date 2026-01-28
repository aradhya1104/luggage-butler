import { Package, Lock, Truck } from "lucide-react";

const steps = [
  {
    icon: Package,
    step: "01",
    title: "Book & Schedule",
    description: "Choose your pickup location and time. We'll come to you – hotel, airport, or anywhere in the city.",
    color: "accent",
  },
  {
    icon: Lock,
    step: "02",
    title: "Secure Storage",
    description: "Your luggage is stored in our climate-controlled, 24/7 monitored facility with full insurance coverage.",
    color: "primary",
  },
  {
    icon: Truck,
    step: "03",
    title: "Delivery on Demand",
    description: "Request your bags back anytime. We'll deliver them to any location in the city within 2 hours.",
    color: "success",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-card">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium mb-4">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Three easy steps to freedom. No more dragging heavy bags around the city.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className="relative group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-border" />
              )}

              <div className="relative bg-background rounded-2xl p-8 border border-border hover:border-accent/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
                {/* Step Number */}
                <div className="absolute -top-4 left-8 px-3 py-1 bg-secondary text-foreground text-sm font-bold rounded-full">
                  {step.step}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                  step.color === "accent" 
                    ? "bg-accent/10" 
                    : step.color === "primary" 
                    ? "bg-primary/10" 
                    : "bg-success/10"
                }`}>
                  <step.icon className={`w-8 h-8 ${
                    step.color === "accent" 
                      ? "text-accent" 
                      : step.color === "primary" 
                      ? "text-primary" 
                      : "text-success"
                  }`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
