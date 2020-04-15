# Permissions

## createPermissions

- **resources** *(string|array)*: names of resources
- **actions**  *(string|array)*: names of actionns
- **options** *(object)* :
  - **names** *(array, optional)* : names of permissions, auto created when not provided.
  - **all** *(boolean, default : false)* : if set to true, will return all the permission you wanted to create, returns only created permissions by default.

### Notes

**options.Names** : names are processed in order, so they must be provided with respect to resource, if you want to ommit name for some, you can pass empty string ('') in its place. Name will be auto generated in that case.

### Example

```js
  acl.createPermissions(['blogs','users'], ['view','edit'], {
    names:['blog_user']
  }).then(function(permissions){

  }).catch((err)=>{
      console.log(err);
  })
```

This will create following permissions

|fields | Perimission 1 | Permission 2
|---|---|---|
|name     | blog_user  | users:[view,edit] |
|resources| blogs  | users
|action   | ['view','edit'] | ["view","edit"]
