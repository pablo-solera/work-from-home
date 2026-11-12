const assistantDateFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function formatAssistantDate(date: string) {
  return assistantDateFormatter.format(new Date(`${date}T00:00:00Z`));
}
