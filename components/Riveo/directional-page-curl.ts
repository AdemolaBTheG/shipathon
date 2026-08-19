import { frag } from "./ShaderLib";

export const directionalPageCurl = frag`
uniform shader image;
uniform float2 resolution;
uniform float2 contentSize;
uniform float2 drag;
uniform float shineProgress;

const float PI = ${Math.PI};

half4 applyShine(half4 color, float2 xy) {
  float2 contentOrigin = (resolution - contentSize) * 0.5;
  float2 uv = (xy - contentOrigin) / contentSize;
  float diagonal = (uv.x + uv.y) * 0.5;
  float distanceToSweep = abs(diagonal - shineProgress);
  float softSweep = 1.0 - smoothstep(0.025, 0.15, distanceToSweep);
  float brightCore = 1.0 - smoothstep(0.0, 0.035, distanceToSweep);
  float strength = softSweep * 0.17 + brightCore * 0.13;
  color.rgb += half3(strength) * color.a;
  return color;
}

half4 main(float2 xy) {
  float dragLength = length(drag);
  if (dragLength < 0.5) {
    return applyShine(image.eval(xy), xy);
  }

  // The grabbed edge trails the finger: dragging right peels the left edge.
  float2 direction = -drag / dragLength;
  float2 center = resolution * 0.5;
  float halfExtent = 0.5 * (
    abs(direction.x) * contentSize.x +
    abs(direction.y) * contentSize.y
  );
  float fold = halfExtent - dragLength * 0.96;
  float projected = dot(xy - center, direction);
  float distanceFromFold = projected - fold;

  if (distanceFromFold <= 0.0) {
    half4 flatColor = image.eval(xy);
    float contactShadow = 1.0 - 0.12 * smoothstep(-18.0, 0.0, distanceFromFold);
    flatColor.rgb *= contactShadow;
    return applyShine(flatColor, xy);
  }

  float curlRadius = min(contentSize.x, contentSize.y) * 0.18;
  if (distanceFromFold >= curlRadius) {
    return half4(0.0);
  }

  float theta = asin(clamp(distanceFromFold / curlRadius, 0.0, 1.0));
  float frontArc = theta * curlRadius;
  float backArc = (PI - theta) * curlRadius;
  float frontProjection = fold + frontArc;
  float backProjection = fold + backArc;
  float2 frontPoint = xy + direction * (frontProjection - projected);
  float2 backPoint = xy + direction * (backProjection - projected);
  bool backsideIsInside = backProjection <= halfExtent;
  half4 originalColor = image.eval(xy);
  half4 frontColor = image.eval(frontPoint);
  half4 backColor = image.eval(backPoint);
  bool hasBackside = backsideIsInside && backColor.a > 0.01;
  bool hasFront = frontColor.a > 0.01;
  half4 color = hasBackside
    ? backColor
    : (hasFront ? frontColor : originalColor);

  float curve = sin(theta);
  if (hasBackside) {
    // A cool, lifted backside makes the fold read as depth rather than erasure.
    color.rgb = mix(color.rgb * 0.58, half3(0.88), 0.18 + curve * 0.12);
  } else {
    color.rgb *= 0.72 + curve * 0.34;
  }
  color.rgb += half3(curve * 0.08) * color.a;
  float seamBacking = 1.0 - smoothstep(0.12, 0.48, distanceFromFold / curlRadius);
  color = color + originalColor * (1.0 - color.a) * seamBacking;
  color.a *= 1.0 - smoothstep(0.94, 1.0, distanceFromFold / curlRadius);
  return applyShine(color, xy);
}
`;
