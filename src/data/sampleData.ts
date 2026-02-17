export interface ProjectImage {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
}

export interface ConsentPDF {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
}

export interface ModelResult {
  id: string;
  participantName: string;
  imageId: string;
  pdfId: string;
  status: "match" | "no-match" | "pending";
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed" | "draft";
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  enrolledUsers: string[];
  images: ProjectImage[];
  pdfs: ConsentPDF[];
  modelResults: ModelResult[];
}

export const sampleProjects: Project[] = [
  {
    id: "proj-1",
    name: "Summer Campaign 2025",
    description: "Photography consent management for the summer marketing campaign featuring outdoor lifestyle shots across multiple locations.",
    status: "active",
    participantCount: 12,
    createdAt: "2025-06-01",
    updatedAt: "2025-07-15",
    enrolledUsers: ["user"],
    images: [
      { id: "img-1", name: "beach_portrait_01.jpg", url: "/placeholder.svg", uploadedBy: "admin" },
      { id: "img-2", name: "outdoor_group_02.jpg", url: "/placeholder.svg", uploadedBy: "admin" },
      { id: "img-3", name: "sunset_candid_03.jpg", url: "/placeholder.svg", uploadedBy: "user" },
      { id: "img-4", name: "studio_headshot_04.jpg", url: "/placeholder.svg", uploadedBy: "user" },
    ],
    pdfs: [
      { id: "pdf-1", name: "consent_john_doe.pdf", url: "#", uploadedBy: "admin" },
      { id: "pdf-2", name: "consent_jane_smith.pdf", url: "#", uploadedBy: "admin" },
      { id: "pdf-3", name: "consent_user_sample.pdf", url: "#", uploadedBy: "user" },
    ],
    modelResults: [
      { id: "mr-1", participantName: "John Doe", imageId: "img-1", pdfId: "pdf-1", status: "match" },
      { id: "mr-2", participantName: "Jane Smith", imageId: "img-2", pdfId: "pdf-2", status: "match" },
      { id: "mr-3", participantName: "Unknown", imageId: "img-3", pdfId: "", status: "no-match" },
      { id: "mr-4", participantName: "Pending Review", imageId: "img-4", pdfId: "pdf-3", status: "pending" },
    ],
  },
];
