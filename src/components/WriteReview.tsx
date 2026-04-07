import { useState } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const WriteReview = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rating || !review) {
      toast({ title: "Please fill all fields", description: "Name, rating, and review are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast({ title: "Thank you! 🎉", description: "Your review has been submitted successfully." });
      setName("");
      setRating(0);
      setReview("");
      setSubmitting(false);
    }, 800);
  };

  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 bg-success/10 text-success rounded-full text-sm font-medium mb-4">
            Feedback
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Write a Review
          </h2>
          <p className="text-lg text-muted-foreground">
            Share your experience with Luggo and help fellow travelers.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-w-lg mx-auto bg-card rounded-2xl p-8 border border-border shadow-sm space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Your Name</label>
            <Input
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "text-warning fill-warning"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Your Review</label>
            <Textarea
              placeholder="Tell us about your experience..."
              rows={4}
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            <Send className="w-4 h-4 mr-2" />
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default WriteReview;
