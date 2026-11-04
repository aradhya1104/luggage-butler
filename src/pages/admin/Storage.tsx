import AdminStorage from "@/components/AdminStorage";
import { AdminPageHeader } from "./shared";

const Storage = () => (
  <div>
    <AdminPageHeader eyebrow="Warehouse" title="Storage Inventory" />
    <AdminStorage />
  </div>
);

export default Storage;
