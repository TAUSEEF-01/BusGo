import { Routes, Route } from "react-router-dom";
export function OperatorPortal() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-8">Operator Portal</div>} />
    </Routes>
  );
}