import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../api/guest";

const STAGE_OPTIONS = [
  "Interested",
  "Dropped",
  "Counselling",
  "Associate",
  "Course Acc",
  "Potential Batch",
  "QG",
  "Quantier",
  "QPM",
  "Ardentiar",
  "Organier",
  "Foreigner",
];

export default function TasksPageNew() {
  const [activeTab, setActiveTab] = useState("all"); // all | assigned | completed
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [assignModal, setAssignModal] = useState(false);
  const [executiveList, setExecutiveList] = useState([]);
  const [selectedExec, setSelectedExec] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Get current user from sessionStorage
  useEffect(() => {
    const userStr = sessionStorage.getItem("qf_current_user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  // Fetch executives for assignment modal
  useEffect(() => {
    if (assignModal) {
      fetchExecutives();
    }
  }, [assignModal]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("qf_admin_token");
      let url = `${API_BASE}/api/tasks`;

      if (activeTab === "all") {
        url = `${API_BASE}/api/tasks/unassigned`;
      } else if (activeTab === "assigned") {
        url = `${API_BASE}/api/tasks?assigned_to=${currentUser?.id}`;
      } else if (activeTab === "completed") {
        url = `${API_BASE}/api/tasks?status=completed`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentUser?.id]);

  // Fetch tasks based on active tab
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchExecutives = async () => {
    try {
      const token = sessionStorage.getItem("qf_admin_token");
      const res = await fetch(`${API_BASE}/api/users?role=executive`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setExecutiveList(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch communicators:", err);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedTask || !selectedExec) {
      alert("Please select a communicator");
      return;
    }

    try {
      const token = sessionStorage.getItem("qf_admin_token");
      const res = await fetch(`${API_BASE}/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assigned_to: selectedExec }),
      });

      if (res.ok) {
        setAssignModal(false);
        setSelectedTask(null);
        setSelectedExec("");
        fetchTasks();
      } else {
        alert("Failed to assign task");
      }
    } catch (err) {
      console.error("Failed to assign task:", err);
    }
  };

  const handleFormSubmit = async () => {
    if (!selectedTask) return;

    try {
      const token = sessionStorage.getItem("qf_admin_token");
      const payload = {
        ...formData,
        status: "completed",
      };

      const res = await fetch(`${API_BASE}/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Task completed and profile updated!");
        setShowForm(false);
        setSelectedTask(null);
        setFormData({});
        fetchTasks();
      } else {
        alert("Failed to submit form");
      }
    } catch (err) {
      console.error("Failed to submit form:", err);
    }
  };

  const openCommunicationForm = (task) => {
    setSelectedTask(task);
    setFormData({
      full_name_update: task.full_name_update || "",
      location: task.location || "",
      profession: task.profession || "",
      age: task.age || "",
      customer_problem: task.customer_problem || "",
      stage: task.stage || "",
      first_following_date: task.first_following_date || "",
      next_following_date: task.next_following_date || "",
    });
    setShowForm(true);
  };

  const renderTaskList = () => {
    if (loading) return <div className="text-center py-8">লোড করছে...</div>;
    if (tasks.length === 0)
      return <div className="text-center py-8">কোন টাস্ক নেই</div>;

    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div
                onClick={() => {
                  if (activeTab === "assigned") {
                    openCommunicationForm(task);
                  } else if (activeTab === "all") {
                    setSelectedTask(task);
                    setAssignModal(true);
                  }
                }}
                className="flex-1"
              >
                <h3 className="font-semibold text-lg">{task.title}</h3>
                <p className="text-gray-600">{task.description}</p>
                {task.customer_name && (
                  <p className="text-sm text-gray-500">
                    অতিথি: {task.customer_name}
                  </p>
                )}
                {task.stage && (
                  <p className="text-sm text-blue-600">পর্যায়: {task.stage}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    task.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {task.status === "completed" ? "সম্পন্ন" : "অপেক্ষমাণ"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-3 py-3">
      <h1 className="text-3xl font-bold mb-6">টাস্ক ম্যানেজমেন্ট</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-semibold ${
            activeTab === "all"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          সব (অ্যাসাইনমেন্ট পেন্ডিং)
        </button>
        <button
          onClick={() => setActiveTab("assigned")}
          className={`px-4 py-2 font-semibold ${
            activeTab === "assigned"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          আমার টাস্ক
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 font-semibold ${
            activeTab === "completed"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          সম্পন্ন
        </button>
      </div>

      {/* Tasks List */}
      {renderTaskList()}

      {/* Assignment Modal */}
      {assignModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Communicator অ্যাসাইন করুন</h2>
            <p className="mb-4">
              অতিথি: <strong>{selectedTask.customer_name}</strong>
            </p>

            <select
              value={selectedExec}
              onChange={(e) => setSelectedExec(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
            >
              <option value="">-- Communicator নির্বাচন করুন --</option>
              {executiveList.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleAssignTask}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                নিশ্চিত করুন
              </button>
              <button
                onClick={() => {
                  setAssignModal(false);
                  setSelectedTask(null);
                }}
                className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communication Form Modal */}
      {showForm && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
            <h2 className="text-2xl font-bold mb-4">যোগাযোগ ফর্ম</h2>
            <p className="mb-4 text-gray-600">
              অতিথি: <strong>{selectedTask.customer_name}</strong>
            </p>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  সম্পূর্ণ নাম (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={formData.full_name_update || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      full_name_update: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="সম্পূর্ণ নাম"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  অবস্থান (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="অবস্থান"
                />
              </div>

              {/* Profession */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  পেশা (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={formData.profession || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, profession: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="পেশা"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  বয়স (ঐচ্ছিক)
                </label>
                <input
                  type="number"
                  value={formData.age || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age: e.target.value ? parseInt(e.target.value) : "",
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="বয়স"
                />
              </div>

              {/* Guest Problem (Required) */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  সমস্যা / চাহিদা <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.customer_problem || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customer_problem: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2 h-24"
                  placeholder="অতিথির সমস্যা বা চাহিদা বর্ণনা করুন"
                />
              </div>

              {/* Stage (Dropdown) */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  পর্যায় (স্টেজ)
                </label>
                <select
                  value={formData.stage || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, stage: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- পর্যায় নির্বাচন করুন --</option>
                  {STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              {/* First Following Date */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  প্রথম ফলো-আপ তারিখ (ঐচ্ছিক)
                </label>
                <input
                  type="date"
                  value={formData.first_following_date || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      first_following_date: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Next Following Date */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  পরবর্তী ফলো-আপ তারিখ (ঐচ্ছিক)
                </label>
                <input
                  type="date"
                  value={formData.next_following_date || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      next_following_date: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleFormSubmit}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
              >
                জমা দিন এবং টাস্ক সম্পন্ন করুন
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedTask(null);
                  setFormData({});
                }}
                className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
