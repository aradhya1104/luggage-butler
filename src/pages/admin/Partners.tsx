import AdminPartners from "@/components/AdminPartners";
import { AdminPageHeader } from "./shared";

const Partners = () => (
  <div>
    <AdminPageHeader eyebrow="Fleet" title="Delivery Partners" />
    <AdminPartners />
  </div>
);

export default Partners;
