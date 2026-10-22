function activeVisitFilter(user) {
  return {
    status: 'checked-in',
    $or: [
      { checkInEmployee: user._id },
      ...legacyActiveVisitOwnership(user).map(ownership => ({
        checkInEmployee: null,
        ...ownership,
      })),
    ],
  };
}

function legacyActiveVisitOwnership(user) {
  const employeeId = user._id;
  const ownership = [];

  if (user.role === 'so') ownership.push({ createdBy: employeeId, so: employeeId });
  if (user.role === 'se') ownership.push({ createdBy: employeeId, se: employeeId, so: { $exists: false } });
  if (user.role === 'asm') {
    ownership.push({ createdBy: employeeId, asm: employeeId, se: employeeId, so: { $exists: false } });
  }
  if (user.role === 'rsm') {
    ownership.push({
      createdBy: employeeId,
      rsm: employeeId,
      asm: { $exists: false },
      se: employeeId,
      so: { $exists: false },
    });
  }
  if (user.role === 'nsm') {
    ownership.push({
      createdBy: employeeId,
      nsm: employeeId,
      rsm: { $exists: false },
      asm: { $exists: false },
      se: employeeId,
      so: { $exists: false },
    });
  }

  return ownership;
}

activeVisitFilter.legacy = user => ({
  status: 'checked-in',
  checkInEmployee: null,
  $or: legacyActiveVisitOwnership(user),
});

module.exports = activeVisitFilter;
