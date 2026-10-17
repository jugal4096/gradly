import {
    collection,
    doc,
    getDoc,
    setDoc,
  } from "firebase/firestore";
  
  import { db } from "../../config/firebase";
  import type {
    GradeDefinition,
    GradingSystem,
  } from "../../domain/grading/gradingSystem.types";
  
  const gradingSystemsCollection = collection(
    db,
    "gradingSystems"
  );
  
  export async function getGradingSystemById(
    gradingSystemId: string
  ): Promise<GradingSystem | null> {
    const gradingRef = doc(
      gradingSystemsCollection,
      gradingSystemId
    );
  
    const snapshot = await getDoc(gradingRef);
  
    if (!snapshot.exists()) {
      return null;
    }
  
    return snapshot.data() as GradingSystem;
  }
  
  export async function createGradingSystem(
    gradingSystem: GradingSystem
  ): Promise<void> {
    const gradingRef = doc(
      gradingSystemsCollection,
      gradingSystem.id
    );
  
    await setDoc(gradingRef, gradingSystem);
  }
  
  export async function createGradeDefinition(
    grade: GradeDefinition
  ): Promise<void> {
    const gradesCollection = collection(
      db,
      "gradingSystems",
      grade.gradingSystemId,
      "grades"
    );
  
    const gradeRef = doc(gradesCollection, grade.id);
  
    await setDoc(gradeRef, grade);
  }