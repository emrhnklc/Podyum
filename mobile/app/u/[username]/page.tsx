import { Suspense } from "react";
import { notFound } from "next/navigation";
import Profil from "@/components/Profil";
import { getUser, users } from "@/lib/demo";

type Params = Promise<{ username: string }>;

export function generateStaticParams() {
  return users.map((user) => ({ username: user.username }));
}

// Listede olmayan kullanıcı adları istek anında çözülür; bu yüzden
// parametre okuması Suspense içinde.
export default function ProfilPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ProfilLoader params={params} />
    </Suspense>
  );
}

async function ProfilLoader({ params }: { params: Params }) {
  const { username } = await params;
  const user = getUser(username);
  if (!user) notFound();
  return <Profil user={user} />;
}
