"use client"

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

const Dashboard = () => {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  const getUsers = async () => {
    console.log('get users')
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <h2>Bienvenido <b>{session?.user.first_name}</b></h2>
      <pre>
        <code>{JSON.stringify(session, null, 2)}</code>
      </pre>
      <Button onClick={getUsers}>Get Users</Button>
    </div>
  );
};
export default Dashboard;
