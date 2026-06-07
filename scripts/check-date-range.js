const XLSX = require("xlsx");
const wb = XLSX.readFile("Sakura_Datos_Importables.xlsx");
const sheets = wb.SheetNames;
sheets.forEach((name) => {
  const json = XLSX.utils.sheet_to_json(wb.Sheets[name]);
  if (json.length === 0) {
    console.log(`${name}: 0 registros`);
    return;
  }
  const cols = Object.keys(json[0]);
  const dateCols = cols.filter(
    (c) =>
      c.toLowerCase().includes("date") ||
      c.toLowerCase().includes("created") ||
      c === "fecha" ||
      c === "fecha_cita"
  );
  if (dateCols.length > 0) {
    const dates = json
      .map((r) => dateCols.map((c) => r[c]).filter(Boolean))
      .flat()
      .map((d) => new Date(d));
    const valid = dates.filter((d) => !isNaN(d.getTime()));
    if (valid.length > 0) {
      const min = new Date(Math.min(...valid));
      const max = new Date(Math.max(...valid));
      console.log(
        `${name}: ${json.length} registros, desde ${min
          .toISOString()
          .split("T")[0]} hasta ${max.toISOString().split("T")[0]}`
      );
    } else {
      console.log(`${name}: ${json.length} registros (sin fechas)`);
    }
  } else {
    console.log(`${name}: ${json.length} registros`);
  }
});
