const normalize = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

const PERSONAL_ORDER = [
  ["full_name", "name"],
  ["mobile", "phone", "phone_number"],
  ["email"],
  ["date_of_birth", "dob", "birth_date"],
  ["age"],
  ["gender", "sex"],
  ["profession", "occupation"],
  ["location", "address", "present_address"],
  ["customer_problem", "problem"],
  ["executive_remarks", "remarks"],
];

const FOLLOWUP_ORDER = [
  ["follow_up_date", "followup_date", "next_following_date", "next_followup_date", "due_date"],
  ["follow_up_note", "followup_note", "follow_up_reason", "followup_reason", "reason"],
];

function rank(key, groups) {
  const normalized = normalize(key);
  const index = groups.findIndex((aliases) => aliases.some((alias) => normalized === alias || normalized.includes(alias)));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function arrangeDataEntries(data = {}) {
  const entries = Object.entries(data).filter(([, value]) => value !== "" && value != null);
  const personal = [];
  const followup = [];
  const other = [];

  entries.forEach((entry, originalIndex) => {
    const [key] = entry;
    const personalRank = rank(key, PERSONAL_ORDER);
    const followupRank = rank(key, FOLLOWUP_ORDER);
    const item = { entry, originalIndex };
    if (personalRank !== Number.MAX_SAFE_INTEGER) personal.push({ ...item, rank: personalRank });
    else if (followupRank !== Number.MAX_SAFE_INTEGER) followup.push({ ...item, rank: followupRank });
    else other.push(item);
  });

  personal.sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex);
  followup.sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex);
  return {
    personal: personal.map((item) => item.entry),
    followup: followup.map((item) => item.entry),
    other: other.map((item) => item.entry),
  };
}

export function arrangeDataKeys(keys = []) {
  const marker = Object.fromEntries(keys.map((key, index) => [key, index]));
  const arranged = arrangeDataEntries(marker);
  return [...arranged.personal, ...arranged.followup, ...arranged.other].map(([key]) => key);
}
