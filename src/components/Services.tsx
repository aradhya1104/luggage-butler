import { Warehouse, Truck, Clock, Package, MapPin, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Warehouse,
    title: "Luggage Storage",
    description: "Secure, climate-controlled storage for any duration. From a few hours to several months.",
    features: ["24/7 CCTV monitoring", "Climate controlled", "Full insurance included"],
  },
  {
    icon: Truck,
    title: "Pickup & Delivery",
    description: "We pick up your luggage from anywhere and deliver it wherever you need in the city.",
    features: ["Door-to-door service", "Real-time tracking", "2-hour delivery window"],
  },
  {
    icon: Clock,
    title: "Same-Day Service",
    description: "Need your bags urgently? Our express service ensures delivery within 2 hours.",
    features: ["Express pickup", "Priority handling", "Live GPS tracking"],
  },
];

const stats = [
  { icon: Package, value: "50K+", label: "Bags Stored" },
  { icon: MapPin, value: "100+", label: "Pickup Points" },
  { icon: Shield, value: "100%", label: "Safe Deliveries" },
  { icon: Clock, value: "24/7", label: "Support" },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Our Services
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground">
            Comprehensive luggage solutions designed for modern travelers.
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group relative bg-card rounded-2xl p-8 border border-border hover:border-accent transition-all duration-300 hover:shadow-xl"
            >
              {/* Gradient Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
              
              <div className="relative">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                  <service.icon className="w-7 h-7 text-accent" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {service.title}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {service.description}
                </p>

                {/* Features */}
                <ul className="space-y-2">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="bg-gradient-primary rounded-2xl p-8 md:p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/10 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-primary-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-primary-foreground/70 text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
