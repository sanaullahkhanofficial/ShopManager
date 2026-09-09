import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  useEffect(() => { api.academic.listClasses().then(setClasses).catch(() => {}); }, []);
  return classes;
}

export function useSections(classId?: number | string) {
  const [sections, setSections] = useState<any[]>([]);
  useEffect(() => {
    if (!classId) { setSections([]); return; }
    api.academic.listSections(Number(classId)).then(setSections).catch(() => {});
  }, [classId]);
  return sections;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  useEffect(() => { api.academic.listSubjects().then(setSubjects).catch(() => {}); }, []);
  return subjects;
}

export function useSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => { api.academic.listSessions().then(setSessions).catch(() => {}); }, []);
  return sessions;
}
