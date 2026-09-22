import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../api/guest.js";
import { useRealtimeRefresh } from "../realtime/realtimeHooks.js";

export default function CommunicationHistory({ customerId }) {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchCommunicationHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("qf_admin_token");
      const res = await fetch(
        `${API_BASE}/api/tasks/customer/${customerId}/communication-history`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) setCommunications(await res.json());
    } catch (err) {
      console.error("Failed to fetch communication history:", err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      fetchCommunicationHistory();
    }
  }, [customerId, fetchCommunicationHistory]);

  useRealtimeRefresh(
    ["communication_logs", "customer_communications", "call_logs"],
    fetchCommunicationHistory,
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("bn-BD");
  };

  if (loading) {
    return <div className="text-center py-8">à¦²à§‹à¦¡ à¦•à¦°à¦›à§‡...</div>;
  }

  if (communications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        à¦•à§‹à¦¨ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦‡à¦¤à¦¿à¦¹à¦¾à¦¸ à¦¨à§‡à¦‡
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold mb-4">à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦‡à¦¤à¦¿à¦¹à¦¾à¦¸</h3>

      {communications.map((comm) => (
        <div
          key={comm.id}
          className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
          onClick={() =>
            setExpandedId(expandedId === comm.id ? null : comm.id)
          }
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {formatDate(comm.created_at)}
                </span>
                {comm.stage && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {comm.stage}
                  </span>
                )}
              </div>

              {expandedId === comm.id && (
                <div className="mt-4 space-y-2 text-sm">
                  {comm.full_name && (
                    <p>
                      <strong>à¦¨à¦¾à¦®:</strong> {comm.full_name}
                    </p>
                  )}
                  {comm.location && (
                    <p>
                      <strong>à¦…à¦¬à¦¸à§à¦¥à¦¾à¦¨:</strong> {comm.location}
                    </p>
                  )}
                  {comm.profession && (
                    <p>
                      <strong>à¦ªà§‡à¦¶à¦¾:</strong> {comm.profession}
                    </p>
                  )}
                  {comm.age && (
                    <p>
                      <strong>à¦¬à¦¯à¦¼à¦¸:</strong> {comm.age}
                    </p>
                  )}
                  {comm.customer_problem && (
                    <p>
                      <strong>à¦¸à¦®à¦¸à§à¦¯à¦¾/à¦šà¦¾à¦¹à¦¿à¦¦à¦¾:</strong> {comm.customer_problem}
                    </p>
                  )}
                  {comm.executive_remarks && (
                    <p>
                      <strong>Communicator à¦®à¦¨à§à¦¤à¦¬à§à¦¯:</strong>{" "}
                      {comm.executive_remarks}
                    </p>
                  )}
                  {comm.first_following_date && (
                    <p>
                      <strong>à¦ªà§à¦°à¦¥à¦® à¦«à¦²à§‹-à¦†à¦ª:</strong>{" "}
                      {formatDate(comm.first_following_date)}
                    </p>
                  )}
                  {comm.next_following_date && (
                    <p>
                      <strong>à¦ªà¦°à¦¬à¦°à§à¦¤à§€ à¦«à¦²à§‹-à¦†à¦ª:</strong>{" "}
                      {formatDate(comm.next_following_date)}
                    </p>
                  )}
                  {comm.executive_name && (
                    <p>
                      <strong>Communicator:</strong> {comm.executive_name}
                    </p>
                  )}
                </div>
              )}

              {expandedId !== comm.id && (
                <div className="mt-2 text-sm text-gray-600 truncate">
                  {comm.executive_remarks ||
                    comm.customer_problem ||
                    "à¦•à§‹à¦¨ à¦¬à¦¿à¦¬à¦°à¦£ à¦¨à§‡à¦‡"}
                </div>
              )}
            </div>

            <div className="text-gray-400 ml-2">
              {expandedId === comm.id ? "â–²" : "â–¼"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
