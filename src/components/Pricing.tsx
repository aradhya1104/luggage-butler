import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Basic Storage",
    price: "$5",
    period: "per bag/day",
    description: "Perfect for short-term storage needs",
    features: [
      "Secure storage facility",
      "24/7 CCTV monitoring",
      "Basic insurance coverage",
      "Self drop-off & pickup",
      "Online booking",
    ],
    popular: false,
  },
  {
    name: "Full Service",
    price: "$12",
    period: "per bag/day",
    description: "Complete pickup and delivery solution",
    features: [
      "Everything in Basic",
      "Door-to-door pickup",
      "City-wide delivery",
      "Real-time tracking",
      "Premium insurance",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Business",
    price: "$99",
    period: "per month",
    description: "For hotels, agencies & businesses",
    features: [
      "Unlimited storage",
      "Multiple pickup points",
      "Dedicated account manager",
      "API integration",
      "Custom branding",
      "Volume discounts",
    ],
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-card">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium mb-4">
            Transparent Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Fair Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            No hidden fees. Pay only for what you use.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-primary text-primary-foreground scale-105 shadow-xl"
                  : "bg-background border border-border hover:border-accent/50 hover:shadow-lg"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-4 py-1.5 bg-accent rounded-full text-accent-foreground text-sm font-medium shadow-accent">
                    <Star className="w-4 h-4 fill-current" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Plan Info */}
              <div className="text-center mb-8">
                <h3 className={`text-xl font-semibold mb-2 ${
                  plan.popular ? "text-primary-foreground" : "text-foreground"
                }`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className={`text-4xl font-bold ${
                    plan.popular ? "text-primary-foreground" : "text-foreground"
                  }`}>
                    {plan.price}
                  </span>
                  <span className={`${
                    plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-3 text-sm ${
                  plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}>
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      plan.popular 
                        ? "bg-primary-foreground/20" 
                        : "bg-success/10"
                    }`}>
                      <Check className={`w-3 h-3 ${
                        plan.popular ? "text-primary-foreground" : "text-success"
                      }`} />
                    </div>
                    <span className={`text-sm ${
                      plan.popular ? "text-primary-foreground/90" : "text-muted-foreground"
                    }`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={plan.popular ? "hero-outline" : "accent"}
                size="lg"
                className="w-full"
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
