import {
    collection,
    doc,
    getDoc,
    setDoc,
  } from "firebase/firestore";
  
  import { db } from "../../config/firebase";
  import type { Curriculum } from "../../domain/curriculum/curriculum.types";
  
  const curriculaCollection = collection(db, "curricula");
  
  export async function getCurriculumById(
    curriculumId: string
  ): Promise<Curriculum | null> {
    const curriculumRef = doc(curriculaCollection, curriculumId);
    const snapshot = await getDoc(curriculumRef);
  
    if (!snapshot.exists()) {
      return null;
    }
  
    return snapshot.data() as Curriculum;
  }
  
  export async function createCurriculum(
    curriculum: Curriculum
  ): Promise<void> {
    const curriculumRef = doc(curriculaCollection, curriculum.id);
  
    await setDoc(curriculumRef, curriculum);
  }