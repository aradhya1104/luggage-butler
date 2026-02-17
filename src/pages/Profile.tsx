import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, User, Phone, Mail, MapPin, Loader2, Save, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface ProfileData {
  full_name: string;
  phone: string;
  address: string;
  email: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone: "",
    address: "",
    email: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/auth");
        return;
      }

      const email = session.user.email || "";

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, address")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
      }

      setProfile({
        full_name: data?.full_name || "",
        phone: data?.phone || "",
        address: data?.address || "",
        email,
      });
      setLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  const handleSave = async () => {
    const trimmedName = profile.full_name.trim();
    const trimmedPhone = profile.phone.trim();
    const trimmedAddress = profile.address.trim();

    if (!trimmedName) {
      toast({ title: "Name required", description: "Please enter your full name", variant: "destructive" });
      return;
    }
    if (trimmedPhone && trimmedPhone.length < 10) {
      toast({ title: "Invalid phone", description: "Phone number must be at least 10 digits", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: trimmedName,
        phone: trimmedPhone || null,
        address: trimmedAddress || null,
      })
      .eq("user_id", session.user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: "Profile updated", description: "Your changes have been saved" });
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
          <p className="text-muted-foreground mb-8">Manage your personal information</p>

          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Update your name, phone number, and address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Enter your full name"
                  value={profile.full_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  maxLength={100}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  maxLength={15}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Address
                </Label>
                <Textarea
                  id="address"
                  placeholder="Enter your address"
                  value={profile.address}
                  onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                  maxLength={500}
                  rows={3}
                />
              </div>

              {/* Save Button */}
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
