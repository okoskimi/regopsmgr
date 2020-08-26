import React from 'react';
import Form from '@rjsf/material-ui';
import { FormProps, IChangeEvent, ErrorSchema } from '@rjsf/core';

interface SchemaFormProps<T> extends FormProps<T> {
  onCalculate?: (formData: T, updatedField?: keyof T) => T;
}
interface SchemaFormState<T> {
  originalFormData: T | undefined;
  formData: T;
}

export default class SchemaForm<T> extends React.Component<
  SchemaFormProps<T>,
  SchemaFormState<T>
> {
  // state: SchemaFormState<T>;
  calculating: boolean;

  constructor(props: SchemaFormProps<T>) {
    super(props);
    const formData = this.props.formData
      ? (this.props.formData as T)
      : ({} as T);
    this.state = {
      // eslint-disable-next-line react/no-unused-state
      originalFormData: formData,
      formData
    };
    this.calculating = false;
  }

  onChange(e: IChangeEvent<T>, es?: ErrorSchema): void {
    // Exit if we're calculating
    if (this.calculating) {
      return;
    }

    // Set the calculating flag to true to avoid an infinite loop
    this.calculating = true;

    // Pass through the new form data to re-render with the updated value
    this.setState({ formData: e.formData });

    // Get the updated field
    const updatedField = this.getUpdatedField(this.state.formData, e.formData);

    // Use setTimeout to call onCalculate, to let all the events fire to get everything synched up
    setTimeout(() => this.onCalculate(e.formData, updatedField));

    // Call the onChange if it was passed in
    if (this.props.onChange) {
      this.props.onChange(e, es);
    }
  }

  onCalculate(formData: T, updatedField: keyof T): void {
    let updatedFormData = formData;

    // Perform the calculation if it was passed in
    if (this.props.onCalculate) {
      // Get the updated form data
      updatedFormData = this.props.onCalculate(formData, updatedField);
    }

    // Update the form
    this.setState({ formData: updatedFormData });

    // Set calculating to false
    this.calculating = false;
  }

  getUpdatedField(oldFormData: any, newFormData: any): keyof T {
    // Iterate over the properties to find the changed value
    return Object.getOwnPropertyNames(newFormData).find(key => {
      // If we have a primitive data type return the comparison
      switch (typeof newFormData[key]) {
        case 'boolean':
        case 'number':
        case 'string':
          return newFormData[key] !== oldFormData[key];
        default:
          // If it's undefined or null, return the comparison
          if (newFormData[key] === undefined || newFormData[key] === null) {
            return newFormData[key] !== oldFormData[key];
          }
          // We have either another JSON object or Array
          // Return a recursive call to getUpdatedField
          return this.getUpdatedField(oldFormData[key], newFormData[key]);
      }
    }) as keyof T;
  }

  render(): React.ReactNode {
    // Display the form
    return (
      <Form
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...this.props}
        schema={this.props.schema}
        formData={this.state.formData}
        onChange={(e: IChangeEvent<T>, es?: ErrorSchema) => {
          this.onChange(e, es);
        }}
      >
        {this.props.children}
      </Form>
    );
  }
}
