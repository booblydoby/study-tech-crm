// Test script to verify group-student sync
const http = require("http");

const API = "http://localhost:4000/api/v1";
let token = "";
let subjects = [];
let teachers = [];
let groups = [];
let students = [];

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "application/json" }
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;

    const r = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${parsed.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`${res.statusCode}: ${data}`));
        }
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  try {
    console.log("1. Login as admin...");
    const login = await req("POST", "/auth/login", {
      email: "admin@study.local",
      password: "ChangeMe123!"
    });
    token = login.accessToken;
    console.log("   ✓ Logged in");

    console.log("\n2. Create subjects...");
    const eng = await req("POST", "/subjects", { name: "English" });
    const math = await req("POST", "/subjects", { name: "Mathematics" });
    subjects = [eng, math];
    console.log("   ✓ Created subjects: English, Mathematics");

    console.log("\n3. Create teacher...");
    const teacher = await req("POST", "/teachers", {
      fullName: "Jane Teacher",
      email: "jane@test.com",
      phone: "+998901112233",
      specialization: "English"
    });
    teachers.push(teacher);
    console.log("   ✓ Created teacher:", teacher.fullName);

    console.log("\n4. Create groups with schedule...");
    const group1 = await req("POST", "/groups", {
      name: "English A1 Morning",
      subjectId: eng.id,
      teacherId: teacher.id,
      monthlyPrice: 500000,
      schedulePattern: { daysOfWeek: [1, 3, 5], time: "18:00", duration: 90 }
    });
    groups.push(group1);
    console.log("   ✓ Group 1:", group1.name, "- schedule:", JSON.stringify(group1.schedulePattern));

    const group2 = await req("POST", "/groups", {
      name: "Mathematics B1",
      subjectId: math.id,
      teacherId: teacher.id,
      monthlyPrice: 400000,
      schedulePattern: { daysOfWeek: [2, 4], time: "16:00", duration: 60 }
    });
    groups.push(group2);
    console.log("   ✓ Group 2:", group2.name, "- schedule:", JSON.stringify(group2.schedulePattern));

    console.log("\n5. Create student with BOTH groups...");
    const student = await req("POST", "/students", {
      fullName: "Ivan Ivanov",
      phone: "+998901234567",
      groupIds: [group1.id, group2.id],
      teacherCommission: 30,
      totalLessons: 12
    });
    students.push(student);
    console.log("   ✓ Created student:", student.fullName);

    console.log("\n6. Fetch student details to verify enrollments...");
    const studentDetail = await req("GET", `/students/${student.id}`);
    const enrollments = studentDetail.enrollments || [];
    console.log(`   Enrollments: ${enrollments.length}`);
    enrollments.forEach((e) => {
      console.log(`   - ${e.subject?.name} (${e.type}) - ${e.price} сум - Teacher: ${e.teacher?.fullName}`);
      console.log(`     Group: ${e.group?.name || "N/A"}`);
    });

    if (enrollments.length === 2) {
      console.log("\n   ✓ SYNCHRONIZATION OK: Student has 2 enrollments");
    } else {
      console.log("\n   ✗ ERROR: Expected 2 enrollments, got", enrollments.length);
    }

    console.log("\n7. Check group students...");
    const groupStudents = await req("GET", `/groups/${group1.id}/students`);
    console.log(`   Group "${group1.name}" has ${groupStudents.length} students`);
    groupStudents.forEach((s) => {
      console.log(`   - ${s.fullName}: ${s.price} сум (custom: ${s.isCustomPrice})`);
    });

    if (groupStudents.length === 1) {
      console.log("   ✓ SYNCHRONIZATION OK: Group has 1 student");
    }

    console.log("\n8. Verify student subjects on students list...");
    const allStudents = await req("GET", "/students");
    const s = allStudents.find((s) => s.id === student.id);
    const subjectsList = s?.enrollments?.map((e) => e.subject?.name).join(", ") || "none";
    console.log(`   Student subjects: ${subjectsList}`);
    if (s?.enrollments?.length === 2) {
      console.log("   ✓ SUBJECTS OK: Student shows 2 subjects");
    }

    console.log("\n✅ ALL TESTS PASSED!");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  }
}

main();
