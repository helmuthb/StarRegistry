describe('Validation', () => {
  const { ValidationList } = require('../addressValidation');

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should maintain the validation list', () => {
    let validationList = new ValidationList();
    expect(validationList.list.length).toBe(0);
  });

  it ('should create validations', () => {
    let validationList = new ValidationList();
    let val = validationList.getValidation('dummy-address');
    expect(val.address).toBe('dummy-address');
    expect(validationList.list.length).toBe(1);
  });

  it ('should update validations', () => {
    let validationList = new ValidationList();
    let val1 = validationList.getValidation('dummy-address');
    let val1Window = val1.validationWindow;
    jasmine.clock().tick(2000);
    let val2 = validationList.getValidation('dummy-address');
    let val2Window = val2.validationWindow;
    expect(val1Window).not.toBe(val2Window);
  });

  it ('should cleanup the validation list', () => {
    let validationList = new ValidationList();
    let val = validationList.getValidation('dummy-address');
    expect(validationList.list.length).toBe(1);
    jasmine.clock().tick(60001);
    jasmine.clock().tick(60001);
    jasmine.clock().tick(60001);
    jasmine.clock().tick(60001);
    jasmine.clock().tick(60001);
    jasmine.clock().tick(60001);
    expect(validationList.list.length).toBe(0);
  });

  it ('should find existing validations', () => {
    let validationList = new ValidationList();
    let val1 = validationList.getValidation('dummy-address');
    let val1String = JSON.stringify(val1);
    jasmine.clock().tick(2000);
    let val2 = validationList.findValidation('dummy-address');
    let val2String = JSON.stringify(val2);
    expect(val1String).toBe(val2String);
  });

  it ('should not find non-existing validations', () => {
    let validationList = new ValidationList();
    let val = validationList.findValidation('dummy-address');
    expect(val).toBeUndefined();
  });
});
  