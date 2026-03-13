/**
 * codename.ts
 * Deterministic anonymisation for confidential student records.
 *
 * Code format : [CLASS][SECTION?]-[ROLL_PADDED | ID_SUFFIX]
 * Examples    : "7A-042", "8-X3B4C", "10B-019"
 *
 * The codeName is stored on the Student document (generated on first
 * save) so it is stable across requests.
 *
 * Visibility rules when isConfidential = true:
 *   CITTAA_ADMIN  → full student data (name + roll number)
 *   All others    → code name only; sensitive fields stripped
 */

/**
 * Pure function — generates a deterministic code name from student
 * fields.  Call this only when the stored codeName is absent.
 */
export function generateCodeName(student: {
  class?: string
  section?: string
  rollNumber?: string | number
  _id?: any
}): string {
  const cls    = (student.class   || '').replace(/\s+/g, '').toUpperCase()
  const sec    = (student.section || '').replace(/\s+/g, '').toUpperCase()
  const prefix = `${cls}${sec}`

  if (student.rollNumber) {
    const roll = String(student.rollNumber).padStart(3, '0')
    return `${prefix}-${roll}`
  }

  // Fallback: last 5 hex chars of Mongoose ObjectId
  const id     = student._id?.toString() || 'XXXXX'
  const suffix = id.slice(-5).toUpperCase()
  return `${prefix}-${suffix}`
}

/**
 * Roles that can see real student identity even when the request is
 * marked confidential.
 */
const FULL_ACCESS_ROLES = new Set(['CITTAA_ADMIN'])

/**
 * Apply anonymisation to a populated `studentId` object.
 *
 * @param student       - Populated student object from Mongoose .lean()
 * @param isConfidential - Whether the counselling request is confidential
 * @param viewerRole     - The authenticated user's role
 */
export function maskStudentIfConfidential(
  student: any,
  isConfidential: boolean,
  viewerRole: string,
): any {
  if (!isConfidential)                   return student
  if (FULL_ACCESS_ROLES.has(viewerRole)) return student   // Admin sees all

  // Everyone else gets the code name only
  const codeName: string =
    student.codeName || generateCodeName(student)

  return {
    _id:           student._id,
    schoolId:      student.schoolId,
    class:         student.class,
    section:       student.section,
    // Masked fields
    name:          codeName,
    codeName,
    isActive:      student.isActive,
    _isAnonymised: true,
    // Sensitive fields deliberately omitted:
    //   rollNumber, parentName, parentPhone, parentEmail, age, gender
  }
}
