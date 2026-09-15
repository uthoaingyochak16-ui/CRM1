import { API_BASE } from "../api/guest.js";

function profileImageSrc(imageUrl) {
  if (!imageUrl) return "";
  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE}${imageUrl}`;
}

export default function ProfileAvatar({
  name = "",
  imageUrl = "",
  className = "h-8 w-8",
  fallbackClassName = "bg-blue-600",
}) {
  const shared = `${className} flex-shrink-0 rounded-full object-cover`;
  if (imageUrl) {
    return <img src={profileImageSrc(imageUrl)} alt={name || "Profile"} className={shared} />;
  }
  return (
    <div className={`${shared} flex items-center justify-center text-[11px] font-bold text-white ${fallbackClassName}`}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
