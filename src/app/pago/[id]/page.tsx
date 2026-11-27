import Checkout from "./checkout";

export default async function PaginaPago({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Checkout id={id} />;
}
