const base = { flow: 'ribbon', hill: false, taper: false, black: true, transparency: 0, mirrored: false, colors: false, mountains: false, flight: false, variation: false, variationAmount: 4 };
export const PRESETS = [
  { id: 'radial', name: 'Круговые волны', description: 'Единый волновой рельеф с широким центром. Бас и спектр расходятся кругами, сохраняя рисунок и плавно исчезая.', view: { ...base, flow: 'radial', taper: true, transparency: 35, mirrored: true, variation: true, variationAmount: 6 } },
  { id: 'center', name: 'Звук из центра', description: 'Текущий звук в центре. Волны расходятся к обоим краям, сохраняя форму и плавно исчезая.', view: { ...base, flow: 'center', taper: true, transparency: 35, mirrored: true, variation: true } },
  { id: 'original', name: 'Исходная лента', description: 'Белые линии, чёрная поверхность и движение от ближнего края в глубину.', view: { ...base } },
  { id: 'transparent', name: 'Прозрачные волны', description: 'Все линии видны насквозь. Классическая лента истории.', view: { ...base, black: false } },
  { id: 'stereo', name: 'Стереозеркало', description: 'Левый и правый каналы, бас по центру, лёгкая асимметрия и обычная лента.', view: { ...base, mirrored: true, transparency: 35, variation: true } },
  { id: 'hill', name: 'Мягкий холм', description: 'Прежний вариант: высота ленты поднимается к середине и уменьшается у краёв.', view: { ...base, mirrored: true, transparency: 35, variation: true, hill: true } },
  { id: 'mountains', name: 'Полёт над горами', description: 'Прежний горный рельеф с плавной палитрой и автоматическим полётом.', view: { ...base, mirrored: true, transparency: 35, variation: true, hill: true, colors: true, mountains: true, flight: true } }
];
