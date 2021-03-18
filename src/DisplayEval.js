import React from "react";

function roundedNumber(val, decimals) {
  let numberStr = parseFloat(val).toString();

  let intPart = numberStr.split(".")[0];
  let i = intPart.length % 3;

  let finalString = intPart.slice(0, i);
  console.log(intPart, i, finalString);
  while (i < intPart.length - 1) {
    if (finalString !== "") finalString += ".";
    finalString += intPart.slice(i, i + 3);
    i += 3;
  }

  if (numberStr.split(".").length > 1) {
    finalString += "," + numberStr.split(".")[1];
  }

  return finalString;
}

function computeLineTotal(sourceLine, charsPerLine) {
  const words = sourceLine.split(" ");
  let linesCount = 1;
  let lineFill = 0;

  let i = 0;
  while (i < words.length) {
    if (words[i].length > charsPerLine) {
      // A word longer than a line starts on an empty line and is split mid word
      linesCount++;
      if (lineFill !== 0) linesCount++;

      lineFill = 0;
      words[i] = words[i].slice(charsPerLine);
    } else if (
      lineFill + words[i].length > charsPerLine &&
      words[i].length > 0
    ) {
      // This line is too full for the current word, wrap to another line
      linesCount++;
      lineFill = 0;
    } else {
      lineFill += words[i].length + 1;
      i++;
    }
  }

  return linesCount;
}

export default function DisplayEval({
  evaluation,
  sourceLine,
  charsPerLine,
  lineIndex
}) {
  const totalLines = computeLineTotal(sourceLine, charsPerLine);
  let paddingLines = [];

  for (let i = 0; i < totalLines - 1; i++) {
    paddingLines.push(<br key={"line-" + lineIndex + "-padding-" + i} />);
  }

  if (evaluation === "X") {
    return (
      <>
        {paddingLines}
        <br key={"line-" + lineIndex} />
      </>
    );
  }

  if (evaluation === "!") {
    return (
      <>
        {paddingLines}
        <span className="error" key={"line-" + lineIndex}>
          ERR
        </span>
      </>
    );
  }

  const splitEval = evaluation.split(" ");
  const number = roundedNumber(splitEval[0], 12).toString();
  const unit = splitEval.slice(1).join(" ");

  return (
    <>
      {paddingLines}
      <span
        key={"line-" + lineIndex}
        className="value"
        onClick={() => {
          clipboard.writeText(number);
        }}
      >
        {number}
        {unit && " "}
        {unit && <span className="unitOfMeasurement">{unit}</span>}
      </span>
    </>
  );
}
