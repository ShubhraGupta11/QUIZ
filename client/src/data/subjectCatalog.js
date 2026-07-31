// Suggested subject list per Department + Semester number, used to power the
// "New subject name" dropdown on the faculty Subjects page so faculty pick from
// a curriculum instead of typing free text. "Other" is always appended so an
// optional/custom subject not in the list can still be added.

const CATALOG = {
  "Computer Science": {
    1: ["Mathematics I", "Physics", "Basic Electrical Engineering", "Programming in C", "Engineering Graphics"],
    2: ["Mathematics II", "Chemistry", "Data Structures", "Digital Logic Design", "Communication Skills"],
    3: ["Discrete Mathematics", "Object Oriented Programming", "Computer Organization", "Database Management Systems", "Operating Systems"],
    4: ["Design & Analysis of Algorithms", "Theory of Computation", "Computer Networks", "Software Engineering", "Microprocessors"],
    5: ["Web Technologies", "Compiler Design", "Artificial Intelligence", "Java Programming", "Elective I"],
    6: ["Machine Learning", "Cloud Computing", "Cryptography & Network Security", "Mobile Application Development", "Elective II"],
    7: ["Big Data Analytics", "Internet of Things", "Distributed Systems", "Project Work I", "Elective III"],
    8: ["Blockchain Technology", "Project Work II", "Seminar", "Industrial Training", "Elective IV"],
  },
  "Information Technology": {
    1: ["Mathematics I", "Physics", "Programming in C", "Basic Electronics", "Engineering Graphics"],
    2: ["Mathematics II", "Data Structures", "Digital Electronics", "Object Oriented Programming", "Communication Skills"],
    3: ["Database Management Systems", "Computer Networks", "Operating Systems", "Web Programming", "Discrete Mathematics"],
    4: ["Software Engineering", "Java Programming", "Computer Architecture", "Design & Analysis of Algorithms", "Information Security"],
    5: ["Cloud Computing", "Data Mining", "Mobile Computing", ".NET Technologies", "Elective I"],
    6: ["Machine Learning", "Enterprise Resource Planning", "Network Security", "Full Stack Development", "Elective II"],
    7: ["Big Data Analytics", "DevOps", "IT Project Management", "Project Work I", "Elective III"],
    8: ["Emerging Technologies", "Project Work II", "Seminar", "Industrial Training", "Elective IV"],
  },
  "Electronics & Communication": {
    1: ["Mathematics I", "Physics", "Basic Electrical Engineering", "Engineering Graphics", "Programming in C"],
    2: ["Mathematics II", "Electronic Devices", "Network Theory", "Digital Electronics", "Communication Skills"],
    3: ["Signals & Systems", "Analog Electronics", "Electromagnetic Theory", "Electronic Instruments & Measurements", "Discrete Mathematics"],
    4: ["Digital Signal Processing", "Microprocessors & Microcontrollers", "Communication Systems", "Control Systems", "Linear Integrated Circuits"],
    5: ["VLSI Design", "Antenna & Wave Propagation", "Embedded Systems", "Digital Communication", "Elective I"],
    6: ["Wireless Communication", "Optical Communication", "IoT & Applications", "Satellite Communication", "Elective II"],
    7: ["Radar & Navigation Systems", "5G Technology", "Project Work I", "Elective III", "Seminar"],
    8: ["Robotics", "Project Work II", "Industrial Training", "Elective IV", "Seminar"],
  },
  "Electrical Engineering": {
    1: ["Mathematics I", "Physics", "Basic Electrical Engineering", "Engineering Graphics", "Programming in C"],
    2: ["Mathematics II", "Electrical Circuit Theory", "Electromagnetic Fields", "Electronic Devices", "Communication Skills"],
    3: ["Electrical Machines I", "Power Electronics", "Analog Electronics", "Measurement & Instrumentation", "Discrete Mathematics"],
    4: ["Electrical Machines II", "Control Systems", "Power System I", "Digital Electronics", "Signals & Systems"],
    5: ["Power System II", "Microprocessors", "Switchgear & Protection", "Electric Drives", "Elective I"],
    6: ["High Voltage Engineering", "Renewable Energy Systems", "Power System Operation & Control", "Utilization of Electrical Energy", "Elective II"],
    7: ["Smart Grid Technology", "Industrial Automation", "Project Work I", "Elective III", "Seminar"],
    8: ["Electric Vehicles", "Project Work II", "Industrial Training", "Elective IV", "Seminar"],
  },
  "Mechanical Engineering": {
    1: ["Mathematics I", "Physics", "Engineering Mechanics", "Engineering Graphics", "Workshop Practice"],
    2: ["Mathematics II", "Chemistry", "Thermodynamics", "Strength of Materials", "Communication Skills"],
    3: ["Fluid Mechanics", "Manufacturing Processes", "Material Science", "Theory of Machines", "Discrete Mathematics"],
    4: ["Heat Transfer", "Machine Design I", "Dynamics of Machinery", "Manufacturing Technology", "Metrology & Measurements"],
    5: ["Machine Design II", "Refrigeration & Air Conditioning", "CAD/CAM", "Automobile Engineering", "Elective I"],
    6: ["Industrial Engineering", "Power Plant Engineering", "Mechatronics", "Finite Element Analysis", "Elective II"],
    7: ["Robotics", "Renewable Energy Sources", "Project Work I", "Elective III", "Seminar"],
    8: ["Automation & Robotics", "Project Work II", "Industrial Training", "Elective IV", "Seminar"],
  },
  "Civil Engineering": {
    1: ["Mathematics I", "Physics", "Engineering Mechanics", "Engineering Graphics", "Workshop Practice"],
    2: ["Mathematics II", "Chemistry", "Building Materials & Construction", "Surveying I", "Communication Skills"],
    3: ["Strength of Materials", "Fluid Mechanics", "Surveying II", "Concrete Technology", "Discrete Mathematics"],
    4: ["Structural Analysis I", "Geotechnical Engineering", "Hydraulics", "Transportation Engineering", "Building Drawing"],
    5: ["Structural Analysis II", "Design of RCC Structures", "Environmental Engineering", "Water Resources Engineering", "Elective I"],
    6: ["Design of Steel Structures", "Estimation & Costing", "Foundation Engineering", "Highway Engineering", "Elective II"],
    7: ["Earthquake Engineering", "Construction Management", "Project Work I", "Elective III", "Seminar"],
    8: ["Sustainable Construction", "Project Work II", "Industrial Training", "Elective IV", "Seminar"],
  },
  "MBA": {
    1: ["Principles of Management", "Managerial Economics", "Accounting for Managers", "Business Communication", "Organizational Behaviour"],
    2: ["Financial Management", "Marketing Management", "Human Resource Management", "Business Research Methods", "Operations Management"],
    3: ["Strategic Management", "Elective I", "Elective II", "Elective III", "Summer Internship Project"],
    4: ["Entrepreneurship Development", "Elective IV", "Elective V", "Project Work", "Seminar"],
  },
  "MCA": {
    1: ["Mathematical Foundations", "Programming in C", "Digital Logic", "Database Management Systems", "Communication Skills"],
    2: ["Data Structures", "Object Oriented Programming", "Computer Networks", "Operating Systems", "Software Engineering"],
    3: ["Java Programming", "Web Technologies", "Design & Analysis of Algorithms", "Artificial Intelligence", "Elective I"],
    4: ["Machine Learning", "Cloud Computing", "Mobile Application Development", "Project Work", "Elective II"],
  },
};

const GENERIC_FALLBACK = ["Core Subject I", "Core Subject II", "Core Subject III", "Elective I", "Elective II"];

export function getSubjectSuggestions(department, semesterOrder) {
  const list = CATALOG[department]?.[semesterOrder] || GENERIC_FALLBACK;
  return [...list, "Other"];
}
