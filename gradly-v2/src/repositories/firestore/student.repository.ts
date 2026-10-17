import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
  } from "firebase/firestore";
  
  import { db } from "../../config/firebase";
  import type { StudentProfile } from "../../domain/student/studentProfile.types";
  
  const studentsCollection = collection(db, "students");
  
  export async function getStudentById(
    studentId: string
  ): Promise<StudentProfile | null> {
    const studentRef = doc(studentsCollection, studentId);
    const snapshot = await getDoc(studentRef);
  
    if (!snapshot.exists()) {
      return null;
    }
  
    return snapshot.data() as StudentProfile;
  }
  
  export async function createStudent(
    student: StudentProfile
  ): Promise<void> {
    const studentRef = doc(studentsCollection, student.id);
  
    await setDoc(studentRef, student);
  }
  
  export async function updateStudent(
    studentId: string,
    data: Partial<StudentProfile>
  ): Promise<void> {
    const studentRef = doc(studentsCollection, studentId);
  
    await updateDoc(studentRef, data);
  }