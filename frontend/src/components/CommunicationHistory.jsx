import { useState, useEffect } from "react";
import { API_BASE } from "../api/guest.js";
import { useRealtimeRefresh } from "../realtime/RealtimeContext.jsx";

export default function CommunicationHistory({ customerId }) {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (customerId) {
      fetchCommunicationHistory();
    }
  }, [customerId]);

  const fetchCommunicationHistory = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("qf_admin_token");
      const res = await fetch(
        `${API_BASE}/api/tasks/customer/${customerId}/communication-history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        setCommunications(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch communication history:", err);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh(
    ["communication_logs", "customer_communications", "call_logs"],
    fetchCommunicationHistory,
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("bn-BD");
  };

  if (loading) {
    return <div className="text-center py-8">লোড করছে...</div>;
  }

  if (communications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        কোন যোগাযোগ ইতিহাস নেই
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold mb-4">যোগাযোগ ইতিহাস</h3>

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
                      <strong>নাম:</strong> {comm.full_name}
                    </p>
                  )}
                  {comm.location && (
                    <p>
                      <strong>অবস্থান:</strong> {comm.location}
                    </p>
                  )}
                  {comm.profession && (
                    <p>
                      <strong>পেশা:</strong> {comm.profession}
                    </p>
                  )}
                  {comm.age && (
                    <p>
                      <strong>বয়স:</strong> {comm.age}
                    </p>
                  )}
                  {comm.customer_problem && (
                    <p>
                      <strong>সমস্যা/চাহিদা:</strong> {comm.customer_problem}
                    </p>
                  )}
                  {comm.executive_remarks && (
                    <p>
                      <strong>Communicator মন্তব্য:</strong>{" "}
                      {comm.executive_remarks}
                    </p>
                  )}
                  {comm.first_following_date && (
                    <p>
                      <strong>প্রথম ফলো-আপ:</strong>{" "}
                      {formatDate(comm.first_following_date)}
                    </p>
                  )}
                  {comm.next_following_date && (
                    <p>
                      <strong>পরবর্তী ফলো-আপ:</strong>{" "}
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
                    "কোন বিবরণ নেই"}
                </div>
              )}
            </div>

            <div className="text-gray-400 ml-2">
              {expandedId === comm.id ? "▲" : "▼"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
