import {
    collection,
    doc,
    getDoc,
    setDoc,
  } from "firebase/firestore";
  
  import { db } from "../../config/firebase";
  import type { Course } from "../../domain/curriculum/course.types";
  
  const coursesCollection = collection(db, "courses");
  
  export async function getCourseById(
    courseId: string
  ): Promise<Course | null> {
    const courseRef = doc(coursesCollection, courseId);
    const snapshot = await getDoc(courseRef);
  
    if (!snapshot.exists()) {
      return null;
    }
  
    return snapshot.data() as Course;
  }
  
  export async function createCourse(
    course: Course
  ): Promise<void> {
    const courseRef = doc(coursesCollection, course.id);
  
    await setDoc(courseRef, course);
  }