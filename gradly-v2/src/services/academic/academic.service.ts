import {
    calculateCGPA,
    calculateSGPA,
  } from "../../domain/academic/engine";
  
  import type {
    SGPASubject,
    SGPAResult,
  } from "../../domain/academic/engine";
  
  import type {
    CGPASemester,
    CGPAResult,
  } from "../../domain/academic/engine";
  
  export function calculateSemesterSGPA(
    subjects: SGPASubject[]
  ): SGPAResult {
    return calculateSGPA(subjects);
  }
  
  export function calculateAcademicCGPA(
    semesters: CGPASemester[]
  ): CGPAResult {
    return calculateCGPA(semesters);
  }