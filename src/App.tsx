import { Button, Card, Input } from "antd";
import { useState } from "react";
import { useAsterisk } from "./AsteriskProvider";

function App() {
  const { callUser, remoteRef } = useAsterisk();

  const [phone, setPhone] = useState<string>();
  return (
    <>
      <Card>
        <Input
          type="number"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button onClick={() => phone && callUser(phone)}>Call</Button>
      </Card>
      <audio autoPlay muted ref={remoteRef} />
    </>
  );
}

export default App;
